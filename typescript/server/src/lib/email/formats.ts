// Email HTML is a hellish mess of IE5 era nonsense.
// Good luck.

import { ServerConfig, TachiConfig } from "#lib/setup/config";

export function EmailFormatResetPassword(username: string, resetCode: string, ipAddr: string) {
	return {
		html: MainHTMLWrapper(
			`Hey ${username}, you've received a password reset request.<br/><a href="${ServerConfig.OUR_URL}/reset-password?code=${resetCode}">Click here</a> to perform the reset.<br/>If you did not request this reset, report this! This reset request was made by ${ipAddr}.`,
		),
		text: `Hey ${username}, you've received a password reset request. This link
${ServerConfig.OUR_URL}/reset-password?code=${resetCode} will perform the reset.
If you did not request this reset, report this! This reset request was made by ${ipAddr}.`,
	};
}

export function EmailFormatVerifyEmail(username: string, code: string) {
	return {
		html: MainHTMLWrapper(
			`Hey ${username}, You need to verify your email before you can use the site.<br/><a href="${ServerConfig.OUR_URL}/verify-email?code=${code}">Click here</a> to verify your email.`,
		),
		text: `Hey ${username}, You need to verify your email before you can use the site.
Please go to ${ServerConfig.OUR_URL}/verify-email?code=${code} to verify!`,
	};
}

export function MainHTMLWrapper(innerHTML: string) {
	return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta http-equiv="X-UA-Compatible" content="IE=edge">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
		<title>${TachiConfig.NAME}</title>
	</head>
	<body>
		<img src="${ServerConfig.CDN_CONFIG.WEB_LOCATION}/logos/logo-wordmark.png" />
		<hr />
		<div style="text-align: left;">
		${innerHTML}
		</div>
	</body>
	</html>`;
}
