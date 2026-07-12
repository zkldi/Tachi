# Client File Flow

While we have an [OAuth2 Flow](./oauth2.md), that requires another webserver.
What if you just want an API key to throw inside a config file? This is a
common use case.

For this, we have the Client File Flow. This flow is entirely done on our
site, and results in the user downloading a file, or copying a string.

## Outline

!!! note
	This documentation uses `boku.tachi.ac` as the example site. You should
	replace this with the instance of Tachi you're pointing against, if it
	is different.

- You navigate the user to `https://boku.tachi.ac/client-file-flow/YOUR_CLIENT_ID`.
- They are asked if they want to create an API Key for your client.
- If they select yes, an API Key is created for your client, and depending on your client parameters, they get it.


## Download Format

When you create a Tachi API Client, you can select the `File Template` parameter. This will change the format of the key given to the user.

For example, Let's say you wanted the user to download a `.json` file with
your token.

You could set a template of something like:

```json
{
	"tachi-api-token": "%%TACHI_KEY%%",
	"someOtherField": "foo"
}
```

If the `File Template` is not set, it is just output normally, without any templating.

The first instance of `%%TACHI_KEY%%` will be replaced with the generated API key.

The other file parameter you control is the `File Name`. If this is set, the user will be presented with a button that will download the above content.

If it is not set, the contents of the template are shown in browser, and the user will have to copy-paste the API Key.
