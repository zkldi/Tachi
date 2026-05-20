import { log } from "#lib/log/log";
import { Env, ServerConfig } from "#lib/setup/config";
import nodemailer, { type SentMessageInfo, type Transporter } from "nodemailer";

let transporter: Transporter | undefined;

const emailConf = ServerConfig.EMAIL_CONFIG;
log.info({ bootInfo: true }, `Connecting to email server...`);

try {
	transporter = nodemailer.createTransport({
		newline: "unix",

		logger: emailConf.TRANSPORT_OPS?.debug ? log : undefined,
		...emailConf.TRANSPORT_OPS,
	});

	if (Env.NODE_ENV === "test") {
		log.info({ bootInfo: true }, `Skipping SMTP verify in test.`);
	} else {
		transporter.verify((err) => {
			if (err) {
				// Do NOT throw here - this is an async callback and the throw would
				// become an uncaught exception, crashing the process. Log and exit instead.
				log.fatal({ err }, `Could not connect to email server.`);
				process.exit(1);
			} else {
				log.info({ bootInfo: true }, `Successfully connected to email server.`);
			}
		});
	}
} catch (err) {
	log.fatal({ err }, `Failed to create email client.`);
	throw err;
}

export function SendEmail(
	to: string,
	subject: string,
	htmlContent: string,
	textContent: string,
): Promise<SentMessageInfo> | undefined {
	if (Env.NODE_ENV === "test") {
		log.debug(`Stubbed out SendEmail as env was test.`);
		return;
	}

	if (!transporter) {
		log.debug(`Stubbed out SendEmail as transporter was not initialized.`);
		return;
	}

	log.debug(`Sending email to ${to}.`);

	return transporter
		.sendMail({
			from: ServerConfig.EMAIL_CONFIG.FROM,
			to,
			subject,
			html: htmlContent,
			text: textContent,
			headers: transporter.options.headers,
		})
		.catch((err: unknown) => {
			log.error(
				{
					err,
					subject,
					textContent,
					htmlContent,
				},
				`Failed to send email to ${to}.`,
			);
			throw err;
		});
}
