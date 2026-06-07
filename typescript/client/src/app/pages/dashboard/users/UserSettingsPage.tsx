import useSetSubheader from "#components/layout/header/useSetSubheader";
import Card from "#components/layout/page/Card";
import ProfilePicture from "#components/user/ProfilePicture";
import Divider from "#components/util/Divider";
import Icon from "#components/util/Icon";
import Muted from "#components/util/Muted";
import useApiQuery from "#components/util/query/useApiQuery";
import SelectButton from "#components/util/SelectButton";
import { BackgroundContext } from "#context/BackgroundContext";
import { UserContext } from "#context/UserContext";
import { UserSettingsContext } from "#context/UserSettingsContext";
import { type SetState } from "#types/react";
import { APIFetchV1, ToAPIURL } from "#util/api";
import { FetchJSONBody, UppercaseFirst } from "#util/misc";
import { getStoredTheme, mediaQueryPrefers, setTheme, type Themes } from "#util/themeUtils";
import { useFormik } from "formik";
import React, { useContext, useEffect, useRef, useState } from "react";
import Alert from "react-bootstrap/Alert";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import InputGroup from "react-bootstrap/InputGroup";
import Stack from "react-bootstrap/Stack";
import toast from "react-hot-toast";
import { useQueryClient } from "react-query";
import { type integer, type UserDocument, type UserSettingsDocument } from "tachi-common";

interface Props {
	reqUser: UserDocument;
}

export default function UserSettingsDocumentPage({ reqUser }: Props) {
	useSetSubheader(
		["Users", reqUser.username, "Settings"],
		[reqUser],
		`${reqUser.username}'s Settings`,
	);

	const [page, setPage] = useState<"account" | "image" | "preferences" | "socialMedia">("image");

	return (
		<Card className="col-12 offset-lg-2 col-lg-8" header="Settings">
			<div className="row">
				<div className="col-12">
					<div className="btn-group d-flex justify-content-center">
						<SelectButton
							className="text-wrap"
							id="image"
							setValue={setPage}
							value={page}
						>
							<Icon type="image" /> Pictures
						</SelectButton>
						<SelectButton
							className="text-wrap"
							id="socialMedia"
							setValue={setPage}
							value={page}
						>
							<Icon brand type="twitter" /> Social Media
						</SelectButton>
						<SelectButton
							className="text-wrap"
							id="preferences"
							setValue={setPage}
							value={page}
						>
							<Icon type="cogs" /> UI Preferences
						</SelectButton>
						<SelectButton
							className="text-wrap"
							id="account"
							setValue={setPage}
							value={page}
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
				<SelectButton id="email" setValue={setPage} value={page}>
					<Icon type="envelope" /> Email
				</SelectButton>
				<SelectButton id="password" setValue={setPage} value={page}>
					<Icon type="lock" /> Password
				</SelectButton>
				<SelectButton id="username" setValue={setPage} value={page}>
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
						"!email": values.email,
					}),
				},
				true,
				true,
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
		<Form className="d-flex flex-column gap-4" onSubmit={formikEmail.handleSubmit}>
			<Form.Group>
				<Form.Label>Password</Form.Label>
				<Form.Control
					id="!password"
					onChange={formikEmail.handleChange}
					placeholder="Your Current Password"
					type="password"
					value={formikEmail.values["!password"]}
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
					id="email"
					onChange={formikEmail.handleChange}
					placeholder="New Email"
					type="email"
					value={formikEmail.values.email}
				/>
			</Form.Group>
			<Form.Group>
				<Form.Label>Confirm New Email</Form.Label>
				<Form.Control
					id="confEmail"
					onChange={formikEmail.handleChange}
					placeholder="New Email"
					type="email"
					value={formikEmail.values.confEmail}
				/>
			</Form.Group>
			{!(formikEmail.values.email === formikEmail.values.confEmail) && (
				<Form.Text className="text-danger">Emails don't match!</Form.Text>
			)}
			<Button
				className="mt-8"
				disabled={
					!(
						formikEmail.values.email === formikEmail.values.confEmail &&
						formikEmail.values["!password"].length >= 8
					)
				}
				type="submit"
				variant="danger"
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
				true,
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
		<Form className="d-flex flex-column gap-4" onSubmit={formikPassword.handleSubmit}>
			<Form.Group>
				<Form.Label>Old Password</Form.Label>
				<Form.Control
					id="!oldPassword"
					onChange={formikPassword.handleChange}
					placeholder="Your Current Password"
					type="password"
					value={formikPassword.values["!oldPassword"]}
				/>
			</Form.Group>
			<Form.Group>
				<Form.Label>New Password</Form.Label>
				<Form.Control
					id="!password"
					onChange={formikPassword.handleChange}
					placeholder="New Password"
					type="password"
					value={formikPassword.values["!password"]}
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
					id="confPass"
					onChange={formikPassword.handleChange}
					placeholder="New Password"
					type="password"
					value={formikPassword.values.confPass}
				/>
			</Form.Group>
			{!(formikPassword.values["!password"] === formikPassword.values.confPass) && (
				<Form.Text className="text-danger">Passwords don't match!</Form.Text>
			)}
			<Button
				className="mt-8"
				disabled={
					!(
						formikPassword.values["!password"] === formikPassword.values.confPass &&
						formikPassword.values.confPass.length >= 8
					)
				}
				type="submit"
				variant="danger"
			>
				Change Password
			</Button>
		</Form>
	);
}

function ChangeUsernameForm({ reqUser }: { reqUser: UserDocument }) {
	const lastUsernameChange = useApiQuery<
		{ canChange: false; nextChange: integer | null } | { canChange: true }
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
				true,
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
	const [lastTimeout, setLastTimeout] = useState<number | null>(null);

	useEffect(() => {
		if (lastTimeout !== null) {
			clearTimeout(lastTimeout);
		}

		const isValid = /^[a-zA-Z_-][a-zA-Z0-9_-]{2,20}$/u.test(
			nameChangeFormik.values.newUsername,
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
				`/users/${nameChangeFormik.values.newUsername}`,
			);

			setUsernameState((state) => ({
				...state,
				isTaken: usernameQuery.statusCode === 200,
			}));
		}, 600);

		setLastTimeout(handle);
		// deliberately no lastTimeout dependency
		// because it is altered in this fn
	}, [nameChangeFormik.values.newUsername]);

	return (
		<>
			<Form className="d-flex flex-column gap-4" onSubmit={nameChangeFormik.handleSubmit}>
				<Form.Group>
					<Form.Label>Password</Form.Label>
					<Form.Control
						id="!password"
						onChange={nameChangeFormik.handleChange}
						placeholder="Your Current Password"
						type="password"
						value={nameChangeFormik.values["!password"]}
					/>
				</Form.Group>
				<Form.Group>
					<Form.Label>New Username</Form.Label>
					<Form.Control
						className="mb-4"
						id="newUsername"
						onChange={nameChangeFormik.handleChange}
						placeholder="New Username"
						type="text"
						value={nameChangeFormik.values.newUsername}
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
						{new Date(lastUsernameChange.data?.nextChange ?? 0).toLocaleDateString()}.
					</Alert>
				)}
				<Button
					className="mt-8"
					disabled={
						nameChangeFormik.values["!password"].length < 8 ||
						!lastUsernameChange.data?.canChange
					}
					type="submit"
					variant="danger"
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
	const [themeSetting, setThemeSetting] = useState<"system" | Themes>(theme);

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
				true,
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
							onChange={(e) => setThemeSetting(e.target.value as Themes)}
							value={themeSetting}
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
				className="d-flex flex-column gap-4"
				onSubmit={(e) => {
					formik.handleSubmit(e);
					handleThemeSubmit(e);
				}}
			>
				<Form.Group>
					<Form.Check
						checked={formik.values.developerMode}
						id="developerMode"
						label="Developer Mode"
						onChange={formik.handleChange}
						type="checkbox"
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
	const [mediaNonce, setMediaNonce] = useState(0);

	const queryClient = useQueryClient();
	const { setBackground } = useContext(BackgroundContext);
	const { user: ctxUser, setUser } = useContext(UserContext);

	const mediaQs = mediaNonce > 0 ? `?v=${mediaNonce}` : "";

	const handleReset = (ref: React.MutableRefObject<HTMLInputElement | null>) => {
		if (ref.current) {
			ref.current.value = "";
		}
	};

	const afterMediaMutation = async (uploadType: "banner" | "pfp") => {
		setMediaNonce((n) => n + 1);
		if (uploadType === "banner") {
			setBackground(ToAPIURL(`/users/${reqUser.id}/banner?v=${Date.now()}`));
		}
		await Promise.all([
			queryClient.invalidateQueries([`/users/${reqUser.username}`]),
			queryClient.invalidateQueries([`/users/${reqUser.id}`]),
		]);
		if (ctxUser?.id === reqUser.id) {
			const r = await APIFetchV1<UserDocument>("/users/me", {}, true, true);
			if (r.success) {
				setUser(r.body);
			}
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
					accept="image/png,image/jpeg,image/gif"
					className="form-control"
					id="pfp"
					multiple={false}
					onChange={(e) => setPfp(e.target.files![0])}
					ref={pfpInput}
					type="file"
				/>
				<div className="d-flex justify-content-center my-4">
					<ProfilePicture
						src={
							pfp
								? URL.createObjectURL(pfp)
								: ToAPIURL(`/users/${reqUser.id}/pfp`) + mediaQs
						}
						user={reqUser}
					/>
				</div>
				<FileUploadController
					file={pfp}
					onMutationSuccess={afterMediaMutation}
					reqUser={reqUser}
					reset={() => handleReset(pfpInput)}
					setFile={setPfp}
					type="pfp"
				/>
			</Form.Group>
			<Form.Group>
				<Form.Label htmlFor="banner">Profile Banner</Form.Label>
				<input
					accept="image/png,image/jpeg,image/gif"
					className="form-control"
					id="banner"
					multiple={false}
					onChange={(e) => setBanner(e.target.files![0])}
					ref={bannerInput}
					type="file"
				/>
				<img
					className="my-4 w-100 object-fit-cover shadow-sm rounded"
					height={200}
					src={
						banner
							? URL.createObjectURL(banner)
							: ToAPIURL(`/users/${reqUser.id}/banner`) + mediaQs
					}
				/>
				<FileUploadController
					file={banner}
					onMutationSuccess={afterMediaMutation}
					reqUser={reqUser}
					reset={() => handleReset(bannerInput)}
					setFile={setBanner}
					type="banner"
				/>
			</Form.Group>
		</Stack>
	);
}

function SocialMediaForm({ reqUser }: { reqUser: UserDocument }) {
	const queryClient = useQueryClient();
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
				true,
			);

			if (rj.success) {
				await Promise.all([
					queryClient.invalidateQueries([`/users/${reqUser.username}`]),
					queryClient.invalidateQueries([`/users/${reqUser.id}`]),
				]);
			}
		},
	});

	return (
		<Form className="d-flex flex-column gap-4" onSubmit={formik.handleSubmit}>
			{(["discord", "twitter", "github", "steam", "youtube"] as const).map((e, i) => (
				<Form.Group key={e}>
					<Form.Label>{UppercaseFirst(e)}</Form.Label>
					<Form.Control
						id={e}
						onChange={formik.handleChange}
						placeholder={placeholders[e]}
						tabIndex={i + 1}
						type="text"
						value={formik.values[e]}
					/>
				</Form.Group>
			))}
			<Form.Group>
				<Form.Label>Twitch</Form.Label>
				<Form.Control
					id="twitch"
					onChange={formik.handleChange}
					placeholder={placeholders.twitch}
					tabIndex={6}
					type="text"
					value={formik.values.twitch}
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
	onMutationSuccess,
}: {
	file?: File;
	onMutationSuccess: (uploadType: "banner" | "pfp") => Promise<void> | void;
	reqUser: UserDocument;
	reset: () => void;
	setFile: SetState<File | undefined>;
	type: "banner" | "pfp";
}) {
	return (
		<div className="d-flex justify-content-end">
			{file ? (
				<Button
					onClick={() => {
						setFile(undefined);
						reset();
					}}
					variant="secondary"
				>
					Cancel
				</Button>
			) : (
				<Button
					disabled={
						type === "pfp" ? !reqUser.customPfpLocation : !reqUser.customBannerLocation
					}
					onClick={async () => {
						if (
							confirm(
								`Are you sure you want to clear your ${
									type === "pfp" ? "profile picture?" : "profile banner?"
								}`,
							)
						) {
							const res = await APIFetchV1(
								`/users/me/${type}`,
								{ method: "DELETE" },
								true,
								true,
							);

							if (res.success) {
								await onMutationSuccess(type);
							}
						}
					}}
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
					disabled={file.size > 1024 * 1000}
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
							true,
						);

						if (res.success) {
							setFile(undefined);
							reset();
							await onMutationSuccess(type);
						}
					}}
					variant="success"
				>
					Submit
				</Button>
			)}
		</div>
	);
}
