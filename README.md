# @particular./stripe-distinct-usage-tracking

[![npm version](https://img.shields.io/npm/v/@particular./stripe-distinct-usage-tracking.svg)](https://www.npmjs.com/package/@particular./stripe-distinct-usage-tracking) [![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release) [![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier) [![CircleCI](https://img.shields.io/circleci/project/github/uniquelyparticular/stripe-distinct-usage-tracking.svg?label=circleci)](https://circleci.com/gh/uniquelyparticular/stripe-distinct-usage-tracking) ![dependency status: david](https://img.shields.io/david/uniquelyparticular/stripe-distinct-usage-tracking.svg)

> Stripe usage tracking implementation to increment usage record only for distinct new entities

Built with [Micro](https://github.com/zeit/micro)! 🤩

## 🛠 Setup

Create a `.env` at the project root with the following credentials:

```dosini
USAGETRACKING_ORIGIN_WHITELIST=*.mysite.com,*.mycrmplaform.io,*.mycommerceplaform.com,*.now.sh
```

`USAGETRACKING_ORIGIN_WHITELIST` is a comma separated list of patterns to match against the incoming requests 'Origin' header (ex. `localhost,*.myawesomesite.com,*.now.sh`)

_Optional Additional Parameters_

```dosini
USAGETRACKING_SECRET_HEADER=x-webhook-secret-key
USAGETRACKING_SECRET_VALUE=zxasda
```

`USAGETRACKING_SECRET_HEADER` will default to `'x-webhook-secret-key'` and is if a header is found that matches it to verify that the value sent matches anything you've specified as `USAGETRACKING_SECRET_VALUE`

## 📦 Package

Run the following command to build the app

```bash
yarn install
```

Start the development server

```bash
yarn dev
```

The server will typically start on PORT `3000`, if not, make a note for the next step.

Start ngrok (change ngrok port below from 3000 if yarn dev deployed locally on different port above)

```bash
ngrok http 3000
```

Make a note of the https `ngrok URL` provided.

## 🚀 Deploy

You can easily deploy this function to [now](https://now.sh).

_Contact [Adam Grohs](https://www.linkedin.com/in/adamgrohs/) @ [Particular.](https://uniquelyparticular.com) for any questions._
