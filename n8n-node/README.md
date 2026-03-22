# n8n-nodes-przypominamy

Community node for [n8n](https://n8n.io/) that integrates with the [Przypominamy.com](https://przypominamy.com) SMS/MMS/VMS API.

## Installation

### Via n8n Community Nodes (Recommended)

1. Open your n8n instance
2. Go to **Settings > Community Nodes**
3. Click **Install a community node**
4. Enter `n8n-nodes-przypominamy`
5. Click **Install**

### Manual Installation

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-przypominamy
```

Then restart n8n.

### Docker

Add to your Dockerfile:

```dockerfile
RUN cd /usr/local/lib/node_modules/n8n && \
    npm install n8n-nodes-przypominamy
```

Or use the `N8N_CUSTOM_EXTENSIONS` environment variable:

```yaml
environment:
  - N8N_CUSTOM_EXTENSIONS=/home/node/.n8n/nodes/n8n-nodes-przypominamy
```

## Configuration

### Credentials

1. In n8n, go to **Credentials > New**
2. Search for **Przypominamy.com API**
3. Enter your API key (from Przypominamy.com panel: Ustawienia > API)
4. Click **Save** -- the connection will be tested automatically

## Resources and Operations

### SMS
| Operation | Description |
|-----------|-------------|
| **Send** | Send a single SMS message |
| **Send Bulk** | Send SMS to multiple recipients (same or individual messages) |

### MMS
| Operation | Description |
|-----------|-------------|
| **Send** | Send an MMS message with SMIL multimedia content |

### VMS
| Operation | Description |
|-----------|-------------|
| **Send** | Send a voice message using text-to-speech |

### Account
| Operation | Description |
|-----------|-------------|
| **Check Balance** | Retrieve account balance and info |
| **Verify Number (HLR)** | Verify phone number validity via HLR lookup |

## Usage Examples

### Send a Single SMS

1. Add a **Przypominamy.com** node
2. Select Resource: **SMS**, Operation: **Send**
3. Enter the recipient phone number (international format, e.g., `48500600700`)
4. Enter the message text
5. Optionally set sender name, schedule date, flash SMS, etc.

### Send Bulk SMS (Same Message)

1. Select Resource: **SMS**, Operation: **Send Bulk**
2. Mode: **Same Message to Multiple Recipients**
3. Enter comma-separated phone numbers
4. Enter the message

### Send Bulk SMS (Individual Messages)

1. Select Resource: **SMS**, Operation: **Send Bulk**
2. Mode: **Individual Messages**
3. Add messages with individual recipients and content

### Send Voice Message

1. Select Resource: **VMS**, Operation: **Send**
2. Enter recipient number and text-to-speech content
3. Optionally choose voice (Ewa, Maja, Jacek, Jan) and retry attempts

### Verify a Phone Number

1. Select Resource: **Account**, Operation: **Verify Number (HLR)**
2. Enter the phone number to check
3. Returns: status, ported flag, network, country

## API Response Format

All operations return the API response as JSON. Typical successful response:

```json
{
  "success": true,
  "data": {
    "count": 1,
    "messages": [
      {
        "id": "abc123",
        "to": "48500600700",
        "status": "queued",
        "cost": 0.15,
        "parts": 1,
        "sent_at": "2026-03-22T10:00:00.000Z"
      }
    ]
  }
}
```

## Development

```bash
# Clone the repository
git clone https://github.com/przypominamy/n8n-nodes-przypominamy.git
cd n8n-nodes-przypominamy

# Install dependencies
npm install

# Build
npm run build

# Link for local development
npm link
cd ~/.n8n/nodes
npm link n8n-nodes-przypominamy
```

## Support

- API Documentation: https://przypominamy.com/api-docs
- Issues: https://github.com/przypominamy/n8n-nodes-przypominamy/issues
- Email: kontakt@przypominamy.com

## License

MIT
