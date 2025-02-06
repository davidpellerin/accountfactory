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

## Configuration

1. Create an `accountfactory.json` file in your working directory that looks like this (you can add as many accounts as you want):

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

## Usage

### List AWS Organization Accounts

```bash
$ accountfactory list-accounts
```

### Create New Accounts

```bash
$ accountfactory create-accounts --username <iam-username>
```

### Setup AWS Profiles

```bash
$ accountfactory setup-aws-profiles --username <iam-username> --prefix <profile-prefix>
```

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
