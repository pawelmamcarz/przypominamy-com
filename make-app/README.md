# Przypominamy.com - Make (Integromat) Custom App

Custom app integration for [Make](https://www.make.com/) (formerly Integromat) that connects to the Przypominamy.com SMS/MMS/VMS API.

## Publishing on Make Developer Portal

### Prerequisites

1. A Make account with Developer access
2. Access to the [Make Developer Portal](https://www.make.com/en/developer)
3. A Przypominamy.com API key

### Setup Steps

1. **Log in to Make Developer Portal**
   - Go to https://www.make.com/en/developer
   - Sign in with your Make account

2. **Create a New App**
   - Click "Create a new app"
   - App name: `Przypominamy.com`
   - Description: `Send SMS, MMS, and VMS messages via the Przypominamy.com API`
   - Category: `Communication`

3. **Upload App Definition Files**
   - **Base**: Paste contents of `base.json` into the Base configuration
   - **Connection**: Paste contents of `connection.json` into the Connection configuration
   - **Modules**: For each file in `modules/`, create a new module and paste the JSON

4. **Configure Module Types**
   | Module | Type |
   |--------|------|
   | sendSms | Action |
   | sendSmsBulk | Action |
   | sendMms | Action |
   | sendVms | Action |
   | checkBalance | Action |
   | verifyNumber | Search |
   | incomingSms | Webhook (Instant Trigger) |
   | deliveryReport | Webhook (Instant Trigger) |

5. **Add App Icon**
   - Upload a 512x512 PNG icon for the app
   - Use the Przypominamy.com logo

6. **Test the Connection**
   - Create a test scenario
   - Add the Przypominamy.com app
   - Enter your API key
   - Verify the connection tests successfully (calls GET /v1/balance)

7. **Submit for Review** (optional, for public listing)
   - Fill in all required metadata
   - Provide documentation links
   - Submit for Make team review

### Module Overview

| Module | Description |
|--------|-------------|
| Send SMS | Send a single SMS message |
| Send Bulk SMS | Send SMS to multiple recipients |
| Send MMS | Send an MMS message with SMIL content |
| Send VMS | Send a voice message (text-to-speech) |
| Check Balance | Check account balance |
| Verify Number (HLR) | Verify phone number via HLR lookup |
| Incoming SMS | Trigger on incoming SMS messages |
| Delivery Report | Trigger on delivery status updates |

### File Structure

```
make-app/
  base.json           - Base URL and default headers
  connection.json     - API key authentication config
  modules/
    sendSms.json      - Send single SMS
    sendSmsBulk.json  - Send bulk SMS
    sendMms.json      - Send MMS
    sendVms.json      - Send VMS (voice)
    checkBalance.json - Check account balance
    verifyNumber.json - HLR number verification
    incomingSms.json  - Incoming SMS webhook trigger
    deliveryReport.json - Delivery report webhook trigger
```

### Testing

Before publishing, test each module in a Make scenario:

1. **Send SMS**: Send a test message to your own number
2. **Send Bulk SMS**: Send to 2-3 test numbers
3. **Send MMS**: Send with a simple SMIL payload
4. **Send VMS**: Send a TTS voice message
5. **Check Balance**: Verify balance retrieval
6. **Verify Number**: Run an HLR check on a known number
7. **Webhooks**: Configure webhook URL in your Przypominamy.com account and verify triggers fire

### Support

- API Documentation: https://przypominamy.com/api-docs
- Support Email: kontakt@przypominamy.com
