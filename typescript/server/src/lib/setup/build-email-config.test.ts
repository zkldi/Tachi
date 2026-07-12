import { describe, expect, it } from "vitest";

import { buildEmailConfig } from "./config";

describe("buildEmailConfig", () => {
	it("throws when TACHI_EMAIL_FROM is unset", () => {
		expect(() => buildEmailConfig({})).toThrow(/TACHI_EMAIL_FROM is required/u);
	});

	it("builds Postmark transport when host is smtp.postmarkapp.com", () => {
		const cfg = buildEmailConfig({
			TACHI_EMAIL_FROM: "from@example.com",
			TACHI_EMAIL_HOST: "smtp.postmarkapp.com",
			TACHI_EMAIL_PORT: "587",
			TACHI_EMAIL_SECURE: "false",
			TACHI_EMAIL_AUTH_PASS: "pm-token",
		});
		expect(cfg.TRANSPORT_OPS).toMatchObject({
			host: "smtp.postmarkapp.com",
			port: 587,
			secure: false,
			auth: { user: "pm-token", pass: "pm-token" },
		});
	});

	it("uses TACHI_EMAIL_AUTH_USER for Postmark when only user is set", () => {
		const cfg = buildEmailConfig({
			TACHI_EMAIL_FROM: "from@example.com",
			TACHI_EMAIL_HOST: "smtp.postmarkapp.com",
			TACHI_EMAIL_PORT: "587",
			TACHI_EMAIL_AUTH_USER: "only-user-token",
		});
		expect(cfg.TRANSPORT_OPS).toMatchObject({
			auth: { user: "only-user-token", pass: "only-user-token" },
		});
	});

	it("matches Postmark host case-insensitively for auth token rules", () => {
		const cfg = buildEmailConfig({
			TACHI_EMAIL_FROM: "from@example.com",
			TACHI_EMAIL_HOST: "SMTP.POSTMARKAPP.COM",
			TACHI_EMAIL_PORT: "587",
			TACHI_EMAIL_AUTH_PASS: "pm-token",
		});
		expect(cfg.TRANSPORT_OPS).toMatchObject({
			host: "SMTP.POSTMARKAPP.COM",
			auth: { user: "pm-token", pass: "pm-token" },
		});
	});

	it("throws when Postmark host is set but no token is given", () => {
		expect(() =>
			buildEmailConfig({
				TACHI_EMAIL_FROM: "a@b.com",
				TACHI_EMAIL_HOST: "smtp.postmarkapp.com",
				TACHI_EMAIL_PORT: "587",
			}),
		).toThrow(/TACHI_EMAIL_AUTH_PASS or TACHI_EMAIL_AUTH_USER/u);
	});

	it("builds generic SMTP without auth", () => {
		const cfg = buildEmailConfig({
			TACHI_EMAIL_FROM: "dev@localhost",
			TACHI_EMAIL_HOST: "tachi-mailpit",
			TACHI_EMAIL_PORT: "1025",
			TACHI_EMAIL_SECURE: "false",
		});
		expect(cfg.TRANSPORT_OPS).toEqual({
			host: "tachi-mailpit",
			port: 1025,
			secure: false,
		});
	});

	it("includes auth when user and/or pass are set for generic SMTP", () => {
		const cfg = buildEmailConfig({
			TACHI_EMAIL_FROM: "a@b.com",
			TACHI_EMAIL_HOST: "smtp.example",
			TACHI_EMAIL_PORT: "587",
			TACHI_EMAIL_SECURE: "false",
			TACHI_EMAIL_AUTH_USER: "u",
			TACHI_EMAIL_AUTH_PASS: "p",
		});
		expect(cfg.TRANSPORT_OPS).toMatchObject({
			host: "smtp.example",
			port: 587,
			secure: false,
			auth: { user: "u", pass: "p" },
		});
	});

	it("defaults TACHI_EMAIL_SECURE to false", () => {
		const cfg = buildEmailConfig({
			TACHI_EMAIL_FROM: "a@b.com",
			TACHI_EMAIL_HOST: "h",
			TACHI_EMAIL_PORT: "25",
		});
		expect(cfg.TRANSPORT_OPS).toMatchObject({ secure: false });
	});

	it("throws when generic SMTP is missing host", () => {
		expect(() =>
			buildEmailConfig({
				TACHI_EMAIL_FROM: "a@b.com",
				TACHI_EMAIL_PORT: "1025",
			}),
		).toThrow(/TACHI_EMAIL_HOST is required/u);
	});

	it("throws when generic SMTP is missing port", () => {
		expect(() =>
			buildEmailConfig({
				TACHI_EMAIL_FROM: "a@b.com",
				TACHI_EMAIL_HOST: "localhost",
			}),
		).toThrow(/TACHI_EMAIL_PORT is required/u);
	});

	it("throws when port is not a number", () => {
		expect(() =>
			buildEmailConfig({
				TACHI_EMAIL_FROM: "a@b.com",
				TACHI_EMAIL_HOST: "localhost",
				TACHI_EMAIL_PORT: "nope",
			}),
		).toThrow(/TACHI_EMAIL_PORT must be a number/u);
	});
});
