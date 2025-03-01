# 🏭 accountfactory

[![codecov](https://codecov.io/github/davidpellerin/accountfactory/graph/badge.svg?token=K1B8PQL30L)](https://codecov.io/github/davidpellerin/accountfactory)
[![npm version](https://badge.fury.io/js/@davidpellerin%2Faccountfactory.svg)](https://badge.fury.io/js/@davidpellerin%2Faccountfactory)

A command-line tool for managing [AWS Organizations](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_introduction.html), creating accounts, and setting up IAM users across multiple accounts.

## Features

- Create and manage AWS Organizations accounts (eg: shared, staging, and production environments)
- Set up IAM users across multiple accounts
- Configure AWS CLI profiles automatically
- Store credentials securely in AWS Secrets Manager

## Installation

```bash
npm install -g @davidpellerin/accountfactory
```

## Prerequisites

- Node.js 16 or higher (Node.js 18+ recommended as 16 is EOL)
- AWS CLI installed and configured with appropriate credentials
- AWS Organizations access in your root/management account

## Usage

```bash
accountfactory - AWS Infrastructure deployment tool

Options:
  -V, --version                 output the version number
  -h, --help                    display help for command

Commands:
  list-accounts                 📋 List accounts in your AWS Organization
  generate-skeleton             💀 Generate a skeleton accountfactory.json file
  create-accounts [options]     🚀 Deploy accounts in your AWS Organization
  setup-aws-profiles [options]  🔧 Configure AWS profiles using creds from Secrets Manager
  help [command]                display help for command
```

### List AWS Organization Accounts

```bash
$ AWS_PROFILE=organizations accountfactory list-accounts

┌─────────┬───────────────────────────────────┬────────────────┬─────────────┐
│ (index) │ Email                             │ Id             │ Status      │
├─────────┼───────────────────────────────────┼────────────────┼─────────────┤
│ 0       │ 'sharedservices@example.com'      │ '012345678901' │ 'ACTIVE'    │
│ 1       │ 'staging@example.com'             │ '012345678902' │ 'ACTIVE'    │
│ 2       │ 'production@example.com'          │ '012345678903' │ 'ACTIVE'    │
│ 3       │ 'oldaccount@example.com'          │ '012345678904' │ 'SUSPENDED' │
└─────────┴───────────────────────────────────┴────────────────┴─────────────┘
```

^ In this example I ran this command with `AWS_PROFILE=organizations` (which is a profile I specifically setup with permissions to manage my organization. (see: [IAM permissions](#IAM-Permissions))

### Generate Skeleton

```bash
$ accountfactory generate-skeleton
```

Creates an `accountfactory.json` file in your current directory. It is a json file that you can modify with the list of accounts you want `accountfactory` to create. It will look like this:

```json
{
  "accounts": [
    {
      "accountName": "Shared Services",
      "profileName": "myappname-shared",
      "email": "sharedservices@example.com"
    },
    {
      "accountName": "Staging",
      "profileName": "myappname-staging",
      "email": "staging@example.com"
    },
    {
      "accountName": "Production",
      "profileName": "myappname-production",
      "email": "production@example.com"
    }
  ]
}

```


### Create New Accounts

```bash
$ accountfactory create-accounts --username <iam-username>
```

Iterates through the accounts in `accountfactory.json` and creates those accounts in your AWS Organization.


### Setup AWS Profiles

```bash
$ accountfactory setup-aws-profiles --username <iam-username> --prefix <profile-prefix>
```

This command creates profiles in (`~/.aws/credentials`) for each account. This command uses the `aws` cli tool under the hood.


## Security

This tool requires high-privilege AWS credentials and should be used with caution. It's recommended to:

- Use MFA-protected credentials
- Review all actions before confirming
- Follow the principle of least privilege
- Regularly rotate credentials

## IAM Permissions

Although you could _theoretically_ just give your account `AdministratorAccess` that's really not a good practice.

One good way of limiting the blast radius is to use a dediacted organizations "management account" that you will use to create and manage the child accounts.

Here are the permissions that I use:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "organizations:CreateAccount",
                "organizations:DescribeCreateAccountStatus",
                "organizations:DescribeAccount",
                "organizations:ListAccounts",
                "organizations:ListAWSServiceAccessForOrganization",
                "organizations:EnableAWSServiceAccess",
                "organizations:DescribeOrganization",
                "organizations:ListChildren",
                "organizations:ListRoots"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "iam:CreateRole",
                "iam:AttachRolePolicy",
                "iam:PutRolePolicy",
                "iam:CreatePolicy",
                "iam:ListRoles",
                "iam:GetRole"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "sts:AssumeRole"
            ],
            "Resource": "arn:aws:iam::*:role/OrganizationAccountAccessRole"
        }
    ]
}
```

## Environment Variables

| Variable | Value | Purpose |
|---------------------|--------|----------|
| ACCOUNTFACTORY_ENABLE_LOGGING | true | Enables logging to disk (~/.local/state/accountfactory) |



## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details
