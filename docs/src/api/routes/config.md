# Config Endpoints

These endpoints display certain properties about the Tachi [config file](../../codebase/setup/config.md).

*****

## Return the value of the BEATORAJA_QUEUE_SIZE

`GET /api/v1/config/beatoraja-queue-size`

**Bokutachi Only**

### Response

| Property | Type | Description |
| :: | :: | :: |
| `<body>` | Integer | The value in `conf.json5` for BEATORAJA_QUEUE_SIZE. |


## Return the value of the USC_QUEUE_SIZE

`GET /api/v1/config/usc-queue-size`

**Bokutachi Only**

### Response

| Property | Type | Description |
| :: | :: | :: |
| `<body>` | Integer | The value in `conf.json5` for USC_QUEUE_SIZE. |



