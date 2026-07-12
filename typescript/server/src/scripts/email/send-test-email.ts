import { SendEmail } from "#lib/email/client";
import { MainHTMLWrapper } from "#lib/email/formats";
import { log } from "#lib/log/log";
import { Command } from "commander";

const program = new Command();

program.option("-e, --email <Email to send to>");

program.parse(process.argv);
const options: { email?: string } = program.opts();

if (!options.email) {
	throw new Error(`Need an --email to send to.`);
}

if (require.main === module) {
	(async () => {
		log.info(`Sending email to ${options.email}.`);
		await SendEmail(
			options.email!,
			"Hello World",
			MainHTMLWrapper("Hello world! This is a test email for doing things."),
			"Hello world! This is a test email for doing things.",
		);
		log.info(`Done.`);

		process.exit(0);
	})().catch((err: unknown) => {
		log.error({ err }, `Failed to send test email.`);
		process.exit(1);
	});
}
