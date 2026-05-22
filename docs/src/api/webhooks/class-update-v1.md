# Event: class-update/v1

The content is as follows:

| Property | Type | Description |
| :: | :: | :: |
| `userID` | Integer | The user ID who had a class update. |
| `set` | Game Class Set | The name of the class set that was updated, such as `genocideDan` or `vfClass`. |
| `game` | Game | The game this class update was for. |
| `playtype` | Playtype | The playtype this class update was for. |
| `old` | Null \| String | The old value for this class. If null, the user had no class here before. |
| `new` | String | The new value for this class. |

## Example

```json
{
	"userID": 1,
	"set": "dan",
	"game": "iidx",
	"playtype": "SP",
	"old": null,
	"new": "CHUUDEN"
}
```