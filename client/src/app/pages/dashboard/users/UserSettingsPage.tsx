import { APIFetchV1, ToAPIURL } from "util/api";
import { DelayedPageReload, FetchJSONBody, UppercaseFirst } from "util/misc";
import { Themes, getStoredTheme, mediaQueryPrefers, setTheme } from "util/themeUtils";
import { ONE_DAY } from "util/constants/time";
import useSetSubheader from "components/layout/header/useSetSubheader";
import Card from "components/layout/page/Card";
import ProfilePicture from "components/user/ProfilePicture";
import Divider from "components/util/Divider";
import Icon from "components/util/Icon";
import Muted from "components/util/Muted";
import SelectButton from "components/util/SelectButton";
import { UserSettingsContext } from "context/UserSettingsContext";
import { useFormik } from "formik";
import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import Stack from "react-bootstrap/Stack";
import { integer, UserDocument, UserSettingsDocument } from "tachi-common";
import toast from "react-hot-toast";
import { SetState } from "types/react";
import useApiQuery from "components/util/query/useApiQuery";

interface Props {
	reqUser: UserDocument;
}

export default function UserSettingsDocumentPage({ reqUser }: Props) {
	useSetSubheader(
		["Users", reqUser.username, "Settings"],
		[reqUser],
		`${reqUser.username}'s Settings`
	);

	const [page, setPage] = useState<"image" | "socialMedia" | "preferences" | "account">("image");

	return (
		<Card header="Settings" className="col-12 offset-lg-2 col-lg-8">
			<div className="row">
				<div className="col-12">
					<div className="btn-group d-flex justify-content-center">
						<SelectButton
							className="text-wrap"
							value={page}
							setValue={setPage}
							id="image"
						>
							<Icon type="image" /> Pictures
						</SelectButton>
						<SelectButton
							className="text-wrap"
							value={page}
							setValue={setPage}
							id="socialMedia"
						>
							<Icon type="twitter" brand /> Social Media
						</SelectButton>
						<SelectButton
							className="text-wrap"
							value={page}
							setValue={setPage}
							id="preferences"
						>
							<Icon type="cogs" /> UI Preferences
						</SelectButton>
						<SelectButton
							className="text-wrap"
							value={page}
							setValue={setPage}
							id="account"
						>
							<Icon type="lock" /> Change Email/Password
						</SelectButton>
					</div>
				</div>
				<div className="col-12">
					<Divider className="mt-4 mb-4" />
					{page === "image" ? (
						<ImageForm reqUser={reqUser} />
					) : page === "socialMedia" ? (
						<SocialMediaForm reqUser={reqUser} />
					) : page === "account" ? (
						<AccountSettings reqUser={reqUser} />
					) : (
						<PreferencesForm reqUser={reqUser} />
					)}
				</div>
				<div className="col-12">
					<Divider />
					<Muted>
						Looking to change settings for a specific game? Go to your game profile, and
						select those settings!
					</Muted>
				</div>
			</div>
		</Card>
	);
}

export function AccountSettings({ reqUser }: { reqUser: UserDocument }) {
	const [page, setPage] = useState<"email" | "password" | "username">("email");

	return (
		<>
			<div className="btn-group d-flex justify-content-center">
				<SelectButton value={page} setValue={setPage} id="email">
					<Icon type="envelope" /> Email
				</SelectButton>
				<SelectButton value={page} setValue={setPage} id="password">
					<Icon type="lock" /> Password
				</SelectButton>
				<SelectButton value={page} setValue={setPage} id="username">
					<Icon type="user" /> Username
				</SelectButton>
			</div>
			<Divider />
			{page === "email" ? (
				<ChangeEmailForm reqUser={reqUser} />
			) : page === "password" ? (
				<ChangePasswordForm reqUser={reqUser} />
			) : (
				<ChangeUsernameForm reqUser={reqUser} />
			)}
		</>
	);
}

function ChangeEmailForm({ reqUser }: { reqUser: UserDocument }) {
	const formikEmail = useFormik({
		initialValues: {
			"!password": "",
			email: "",
			confEmail: "",
		},
		onSubmit: async (values) => {
			const r = await APIFetchV1<UserSettingsDocument>(
				`/users/${reqUser.id}/change-email`,
				{
					method: "POST",
					...FetchJSONBody({
						"!password": values["!password"],
						email: values.email,
					}),
				},
				true,
				true
			);

			if (r.success) {
				formikEmail.setValues({
					"!password": "",
					email: "",
					confEmail: "",
				});
			}
		},
	});

	return (
		<Form onSubmit={formikEmail.handleSubmit} className="d-flex flex-column gap-4">
			<Form.Group>
				<Form.Label>Password</Form.Label>
				<Form.Control
					type="password"
					id="!password"
					value={formikEmail.values["!password"]}
					placeholder="Your Current Password"
					onChange={formikEmail.handleChange}
				/>
				{formikEmail.values["!password"].length < 8 && (
					<Form.Text className="text-warning">
						Passwords have to be at least 8 characters long.
					</Form.Text>
				)}
			</Form.Group>
			<Form.Group>
				<Form.Label>New Email</Form.Label>
				<Form.Control
					type="email"
					id="email"
					value={formikEmail.values.email}
					placeholder="New Email"
					onChange={formikEmail.handleChange}
				/>
			</Form.Group>
			<Form.Group>
				<Form.Label>Confirm New Email</Form.Label>
				<Form.Control
					type="email"
					id="confEmail"
					value={formikEmail.values.confEmail}
					placeholder="New Email"
					onChange={formikEmail.handleChange}
				/>
			</Form.Group>
			{!(formikEmail.values.email === formikEmail.values.confEmail) && (
				<Form.Text className="text-danger">Emails don't match!</Form.Text>
			)}
			<Button
				className="mt-8"
				variant="danger"
				type="submit"
				disabled={
					!(
						formikEmail.values.email === formikEmail.values.confEmail &&
						formikEmail.values["!password"].length >= 8
					)
				}
			>
				Change Email
			</Button>
		</Form>
	);
}

function ChangePasswordForm({ reqUser }: { reqUser: UserDocument }) {
	const formikPassword = useFormik({
		initialValues: {
			"!oldPassword": "",
			"!password": "",
			confPass: "",
		},
		onSubmit: async (values) => {
			const r = await APIFetchV1<UserSettingsDocument>(
				`/users/${reqUser.id}/change-password`,
				{
					method: "POST",
					...FetchJSONBody({
						"!oldPassword": values["!oldPassword"],
						"!password": values["!password"],
					}),
				},
				true,
				true
			);

			if (r.success) {
				formikPassword.setValues({
					"!oldPassword": "",
					"!password": "",
					confPass: "",
				});
			}
		},
	});

	return (
		<Form onSubmit={formikPassword.handleSubmit} className="d-flex flex-column gap-4">
			<Form.Group>
				<Form.Label>Old Password</Form.Label>
				<Form.Control
					type="password"
					id="!oldPassword"
					value={formikPassword.values["!oldPassword"]}
					placeholder="Your Current Password"
					onChange={formikPassword.handleChange}
				/>
			</Form.Group>
			<Form.Group>
				<Form.Label>New Password</Form.Label>
				<Form.Control
					type="password"
					id="!password"
					value={formikPassword.values["!password"]}
					placeholder="New Password"
					onChange={formikPassword.handleChange}
				/>
				{formikPassword.values["!password"].length < 8 && (
					<Form.Text className="text-warning">
						Passwords have to be at least 8 characters long.
					</Form.Text>
				)}
			</Form.Group>
			<Form.Group>
				<Form.Label>Confirm New Password</Form.Label>
				<Form.Control
					type="password"
					id="confPass"
					value={formikPassword.values.confPass}
					placeholder="New Password"
					onChange={formikPassword.handleChange}
				/>
			</Form.Group>
			{!(formikPassword.values["!password"] === formikPassword.values.confPass) && (
				<Form.Text className="text-danger">Passwords don't match!</Form.Text>
			)}
			<Button
				className="mt-8"
				variant="danger"
				type="submit"
				disabled={
					!(
						formikPassword.values["!password"] === formikPassword.values.confPass &&
						formikPassword.values.confPass.length >= 8
					)
				}
			>
				Change Password
			</Button>
		</Form>
	);
}

function ChangeUsernameForm({ reqUser }: { reqUser: UserDocument }) {
	const lastUsernameChange = useApiQuery<
		{ canChange: true } | { canChange: false; nextAvailableChange: integer | null }
	>(`/users/${reqUser.id}/last-username-change`);

	const nameChangeFormik = useFormik({
		initialValues: {
			"!password": "",
			newUsername: "",
		},
		onSubmit: async (values) => {
			const r = await APIFetchV1(
				`/users/${reqUser.id}/change-username`,
				{
					method: "POST",
					...FetchJSONBody({
						"!password": values["!password"],
						newUsername: values.newUsername,
					}),
				},
				true,
				true
			);

			if (r.success) {
				nameChangeFormik.setValues({
					"!password": "",
					newUsername: "",
				});

				setTimeout(() => {
					window.location.href = "/u/me";
				}, 300);
			}
		},
	});

	const [usernameState, setUsernameState] = useState({
		isTaken: true,
		isValid: false,
	});
	const [lastTimeout, setLastTimeout] = useState<null | number>(null);

	useEffect(() => {
		if (lastTimeout !== null) {
			clearTimeout(lastTimeout);
		}

		const isValid = /^[a-zA-Z_-][a-zA-Z0-9_-]{2,20}$/u.test(
			nameChangeFormik.values.newUsername
		);

		setUsernameState((state) => ({
			...state,
			isValid,
		}));

		if (!isValid) {
			return;
		}

		const handle = window.setTimeout(async () => {
			const usernameQuery = await APIFetchV1<UserDocument | null>(
				`/users/${nameChangeFormik.values.newUsername}`
			);

			setUsernameState((state) => ({
				...state,
				isTaken: usernameQuery.statusCode === 200,
			}));
		}, 600);

		setLastTimeout(handle);
	}, [nameChangeFormik.values.newUsername]);

	return (
		<>
			<Form onSubmit={nameChangeFormik.handleSubmit} className="d-flex flex-column gap-4">
				<Form.Group>
					<Form.Label>Password</Form.Label>
					<Form.Control
						type="password"
						id="!password"
						value={nameChangeFormik.values["!password"]}
						placeholder="Your Current Password"
						onChange={nameChangeFormik.handleChange}
					/>
				</Form.Group>
				<Form.Group>
					<Form.Label>New Username</Form.Label>
					<Form.Control
						className="mb-4"
						type="text"
						id="newUsername"
						value={nameChangeFormik.values.newUsername}
						placeholder="New Username"
						onChange={nameChangeFormik.handleChange}
					/>
					{nameChangeFormik.values.newUsername.length > 3 && (
						<div className="d-flex flex-column gap-2">
							{usernameState.isValid && usernameState.isTaken && (
								<Alert variant="danger">Username is already in use.</Alert>
							)}

							{!usernameState.isValid && (
								<Alert variant="danger">
									Username is invalid. Must be 3-20 characters long. Must start
									with a letter. Must only contain letters, numbers, and
									underscores.
								</Alert>
							)}
						</div>
					)}
				</Form.Group>
				{!lastUsernameChange.data?.canChange && (
					<Alert variant="danger">
						You can only change your username every 6 months. Your next username change
						will be available on{" "}
						{new Date(
							lastUsernameChange.data?.nextAvailableChange ?? 0
						).toLocaleDateString()}
						.
					</Alert>
				)}
				<Button
					className="mt-8"
					variant="danger"
					type="submit"
					disabled={
						nameChangeFormik.values["!password"].length < 8 ||
						!lastUsernameChange.data?.canChange
					}
				>
					Change Username
				</Button>
			</Form>
		</>
	);
}

function PreferencesForm({ reqUser }: { reqUser: UserDocument }) {
	const { settings, setSettings } = useContext(UserSettingsContext);
	const theme = getStoredTheme() || "system";
	const [themeSetting, setThemeSetting] = useState<Themes | "system">(theme);

	const formik = useFormik({
		initialValues: {
			developerMode: settings?.preferences.developerMode ?? false,
			invisible: settings?.preferences.invisible ?? false,
			contentiousContent: settings?.preferences.contentiousContent ?? false,
			advancedMode: settings?.preferences.advancedMode ?? false,
			deletableScores: settings?.preferences.deletableScores ?? false,
		},
		onSubmit: async (values) => {
			const res = await APIFetchV1<UserSettingsDocument>(
				`/users/${reqUser.id}/settings`,
				{
					method: "PATCH",
					...FetchJSONBody(values),
				},
				true,
				true
			);

			if (res.success) {
				setSettings(res.body);
			}
		},
	});

	const handleThemeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (themeSetting === "system") {
			setTheme(mediaQueryPrefers());
			localStorage.removeItem("theme");
			toast.success("Following system preference!");
		} else {
			setTheme(themeSetting);
			localStorage.setItem("theme", themeSetting);
			toast.success(`Applied ${UppercaseFirst(themeSetting)} theme!`);
		}
	};

	return (
		<Stack gap={4}>
			<Form onSubmit={handleThemeSubmit}>
				<Form.Group>
					<label htmlFor="theme-selector">Theme</label>
					<InputGroup>
						<Form.Select
							value={themeSetting}
							onChange={(e) => setThemeSetting(e.target.value as Themes)}
						>
							<option value="system">Follow system preference</option>
							<option value="light">Light</option>
							<option value="dark">Dark</option>
							<option value="oled">OLED</option>
						</Form.Select>
						<Button type="submit">Apply Theme</Button>
					</InputGroup>
					<Form.Text>Themes are applied per device</Form.Text>
				</Form.Group>
			</Form>
			<Form
				onSubmit={(e) => {
					formik.handleSubmit(e);
					handleThemeSubmit(e);
				}}
				className="d-flex flex-column gap-4"
			>
				<Form.Group>
					<Form.Check
						type="checkbox"
						id="developerMode"
						checked={formik.values.developerMode}
						onChange={formik.handleChange}
						label="Developer Mode"
					/>
					<Form.Text>
						Enable debug information and other useful debugging buttons.
					</Form.Text>
				</Form.Group>
				<Button type="submit">Update Settings</Button>
			</Form>
		</Stack>
	);
}

function ImageForm({ reqUser }: { reqUser: UserDocument }) {
	const [pfp, setPfp] = useState<File | undefined>();

	const pfpInput = useRef<HTMLInputElement>(null);
	const [banner, setBanner] = useState<File | undefined>();
	const bannerInput = useRef<HTMLInputElement>(null);

	const handleReset = (ref: React.MutableRefObject<HTMLInputElement | null>) => {
		if (ref.current) {
			ref.current.value = "";
		}
	};

	return (
		<Stack gap={4}>
			<Alert variant="danger">
				Do not set inappropriate stuff as your avatar/banner. If you have to ask, the answer
				is probably no.
			</Alert>
			<Form.Group>
				<Form.Label htmlFor="pfp">Profile Picture</Form.Label>
				<input
					className="form-control"
					accept="image/png,image/jpeg,image/gif"
					type="file"
					id="pfp"
					multiple={false}
					onChange={(e) => setPfp(e.target.files![0])}
					ref={pfpInput}
				/>
				<div className="d-flex justify-content-center my-4">
					<ProfilePicture
						user={reqUser}
						src={pfp ? URL.createObjectURL(pfp) : ToAPIURL(`/users/${reqUser.id}/pfp`)}
					/>
				</div>
				<FileUploadController
					setFile={setPfp}
					reset={() => handleReset(pfpInput)}
					file={pfp}
					reqUser={reqUser}
					type="pfp"
				/>
			</Form.Group>
			<Form.Group>
				<Form.Label htmlFor="banner">Profile Banner</Form.Label>
				<input
					className="form-control"
					accept="image/png,image/jpeg,image/gif"
					type="file"
					id="banner"
					multiple={false}
					onChange={(e) => setBanner(e.target.files![0])}
					ref={bannerInput}
				/>
				<img
					className="my-4 w-100 object-fit-cover shadow-sm rounded"
					height={200}
					src={
						banner
							? URL.createObjectURL(banner)
							: ToAPIURL(`/users/${reqUser.id}/banner`)
					}
				/>
				<FileUploadController
					setFile={setBanner}
					reset={() => handleReset(bannerInput)}
					file={banner}
					reqUser={reqUser}
					type="banner"
				/>
			</Form.Group>
		</Stack>
	);
}

function SocialMediaForm({ reqUser }: { reqUser: UserDocument }) {
	const placeholders = {
		discord: "Discord Username",
		twitter: "Twitter Handle",
		twitch: "Twitch Username",
		github: "Github Username",
		youtube: "Channel Name",
		steam: "Steam Community ID",
	};

	const formik = useFormik({
		initialValues: {
			discord: reqUser.socialMedia.discord ?? "",
			twitter: reqUser.socialMedia.twitter ?? "",
			twitch: reqUser.socialMedia.twitch ?? "",
			github: reqUser.socialMedia.github ?? "",
			steam: reqUser.socialMedia.steam ?? "",
			youtube: reqUser.socialMedia.youtube ?? "",
		},
		onSubmit: async (values) => {
			const valuesClone: Record<string, string | null> = {};

			for (const v in values) {
				const vx = v as keyof typeof values;
				valuesClone[vx] = values[vx] || null;
			}

			const rj = await APIFetchV1<UserDocument>(
				"/users/me",
				{
					method: "PATCH",
					body: JSON.stringify(valuesClone),
					headers: {
						"Content-Type": "application/json",
					},
				},
				true,
				true
			);

			if (rj.success) {
				DelayedPageReload();
			}
		},
	});

	return (
		<Form onSubmit={formik.handleSubmit} className="d-flex flex-column gap-4">
			{(["discord", "twitter", "github", "steam", "youtube"] as const).map((e, i) => (
				<Form.Group key={e}>
					<Form.Label>{UppercaseFirst(e)}</Form.Label>
					<Form.Control
						tabIndex={i + 1}
						type="text"
						id={e}
						value={formik.values[e]}
						placeholder={placeholders[e]}
						onChange={formik.handleChange}
					/>
				</Form.Group>
			))}
			<Form.Group>
				<Form.Label>Twitch</Form.Label>
				<Form.Control
					tabIndex={6}
					type="text"
					id="twitch"
					value={formik.values.twitch}
					placeholder={placeholders.twitch}
					onChange={formik.handleChange}
				/>
			</Form.Group>
			<Button type="submit" variant="success">
				Submit
			</Button>
		</Form>
	);
}

function SizeWarner({ bytes, cap }: { bytes: number; cap: number }) {
	const kb = bytes / 1_000;

	let className = "text-success";

	if (kb > cap) {
		className = "text-danger";
	} else if (cap * 0.95 < kb) {
		className = "text-warning";
	}

	return (
		<span className={className}>
			{kb}kb/{cap}kb
		</span>
	);
}

function FileUploadController({
	file,
	type,
	reqUser,
	setFile,
	reset,
}: {
	file?: File;
	type: "pfp" | "banner";
	reqUser: UserDocument;
	setFile: SetState<File | undefined>;
	reset: () => void;
}) {
	return (
		<div className="d-flex justify-content-end">
			{file ? (
				<Button
					variant="secondary"
					onClick={() => {
						setFile(undefined);
						reset();
					}}
				>
					Cancel
				</Button>
			) : (
				<Button
					onClick={async () => {
						if (
							confirm(
								`Are you sure you want to clear your ${
									type === "pfp" ? "profile picture?" : "profile banner?"
								}`
							)
						) {
							const res = await APIFetchV1(
								`/users/me/${type}`,
								{ method: "DELETE" },
								true,
								true
							);

							if (res.success) {
								DelayedPageReload();
							}
						}
					}}
					disabled={
						type === "pfp" ? !reqUser.customPfpLocation : !reqUser.customBannerLocation
					}
					variant="danger"
				>
					Clear {type === "pfp" ? "Profile Picture" : "Profile Banner"}
				</Button>
			)}
			{file && (
				<div className="mx-auto">
					<SizeWarner bytes={file.size} cap={1024} />
				</div>
			)}
			{file && (
				<Button
					onClick={async () => {
						const formData = new FormData();
						formData.append(type, file);

						const res = await APIFetchV1(
							`/users/me/${type}`,
							{
								method: "PUT",
								body: formData,
							},
							true,
							true
						);

						if (res.success) {
							window.location.reload();
						}
					}}
					variant="success"
					disabled={file.size > 1024 * 1000}
				>
					Submit
				</Button>
			)}
		</div>
	);
}
