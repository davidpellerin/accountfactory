# accountfactory - AWS Organization Setup Tool

A command-line tool for managing AWS Organizations, creating accounts, and setting up IAM users across multiple accounts.

## Features

- Create and manage AWS Organization accounts (eg: shared, staging, and production environments)
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
  list-accounts                 📋 List accounts in the AWS Organization
  generate-skeleton             💀 Generate a skeleton accountfactory.json file
  create-accounts [options]     🚀 Deploy accounts in the AWS Organization
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

^ In this example I ran this command with AWS_PROFILE=organizations (which is a profile I specifically setup with Organizations IAM permissions)

### Generate Skeleton

```bash
$ accountfactory generate-skeleton
```

Creates an `accountfactory.json` file in your current directory that you can modify with the list of accounts you want to create. It will look like this:

```json
{
  "shared": {
    "accountName": "Shared Services",
    "email": "sharedservices@example.com"
  },
  "staging": {
    "accountName": "Staging",
    "email": "staging@example.com"
  },
  "production": {
    "accountName": "Production",
    "email": "production@example.com"
  }
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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details
