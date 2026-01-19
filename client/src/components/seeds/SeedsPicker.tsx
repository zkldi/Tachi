import { APIFetchV1 } from "util/api";
import { FormatTime } from "util/time";
import { EscapeStringRegexp, TruncateString } from "util/misc";
import Divider from "components/util/Divider";
import FormInput from "components/util/FormInput";
import Icon from "components/util/Icon";
import Select from "components/util/Select";
import React, { useState, useEffect, useMemo } from "react";
import { Button, Modal, Row, Col, Badge } from "react-bootstrap";
import { DatabaseSeedNames } from "tachi-common";
import { Branch, GitCommit, Revision } from "types/git";
import { SetState } from "types/react";
import Card from "components/layout/page/Card";

export default function SeedsPicker({
	hasLocalAPI,
	header,
	rev,
	setRev,
	message,
}: {
	hasLocalAPI: boolean;
	header: string;
	rev: Revision | null;
	setRev: SetState<Revision | null>;
	message?: string;
}) {
	// a repo is one of the following:
	// null - nothing has been selected yet
	// "local" - we're referring to the files on the local development disk
	// "GitHub:NAME/REPO" - we're referring to a repository on github, like GitHub:zkldi/Tachi
	const [repo, setRepo] = useState<string | null>(null);

	// to list commits, we need to know what branch we're looking at.
	// we also need to know the set of all available branches
	const [branch, setBranch] = useState<string | null>(null);
	const [branches, setBranches] = useState<string[] | null>(null);

	const [shaBranchLookup, setSHABranchLookup] = useState<Record<string, string[]>>({});

	// When repo changes, refetch the available branches.
	useEffect(() => {
		if (repo === null) {
			return setBranches(null);
		}

		(async () => {
			if (repo === "local") {
				const res = await APIFetchV1<{ branches: Branch[]; current: Branch | null }>(
					`/seeds/branches`
				);

				if (!res.success) {
					throw new Error(
						`Failed to fetch branches for your local repo. ${res.description}.`
					);
				}

				setBranches(res.body.branches.map((e) => e.name));

				// can't be bothered getting this to work
				// if (res.body.current) {
				// 	setBranch(res.body.current.name);
				// }

				// to get pretty UI stuff, we keep track of the HEADs of all branches
				// so we can render what branch a commit is the HEAD of in the UI.
				const lookup: Record<string, string[]> = {};

				for (const branch of res.body.branches) {
					if (branch.sha in lookup) {
						lookup[branch.sha].push(branch.name);
					} else {
						lookup[branch.sha] = [branch.name];
					}
				}

				setSHABranchLookup(lookup);
			} else if (repo.startsWith("GitHub:")) {
				const repoName = repo.slice("GitHub:".length);

				console.log(repoName);

				const res: Array<{ name: string; commit: { sha: string } }> = await fetch(
					`https://api.github.com/repos/${repoName}/branches`
				).then((r) => r.json());

				setBranches(res.map((e) => e.name));

				const lookup: Record<string, string[]> = {};

				for (const branch of res) {
					if (branch.commit.sha in lookup) {
						lookup[branch.commit.sha].push(branch.name);
					} else {
						lookup[branch.commit.sha] = [branch.name];
					}
				}

				setSHABranchLookup(lookup);
			}
		})();
	}, [repo]);

	// if branches change, re-prompt for users to select a branch
	useEffect(() => {
		setBranch(null);
	}, [branches]);

	const [show, setShow] = useState(false);

	const [subject, body] = useMemo(() => {
		if (rev === null) {
			return [null, null];
		}

		const [subject, _gap, ...maybeBodies] = rev.c.commit.message.split("\n");

		return [subject, maybeBodies?.join("\n") ?? null];
	}, [rev]);

	const [showBody, setShowBody] = useState(false);

	const authorNotCommitter = rev?.c.commit.author.email !== rev?.c.commit.committer.email;

	return (
		<>
			<Card header={header}>
				{rev ? (
					<div className="me-3" style={{ textAlign: "left" }}>
						<span style={{ fontSize: "1.15rem" }}>
							<code>
								{rev.repo}/{rev.c.sha}
							</code>
							: {subject}
						</span>
						{body && (
							<span
								className="ms-4 badge bg-secondary"
								onClick={() => setShowBody(!showBody)}
							>
								{showBody ? (
									<Icon style={{ fontSize: "0.7rem" }} type="chevron-down" />
								) : (
									<Icon style={{ fontSize: "0.7rem" }} type="chevron-left" />
								)}
							</span>
						)}
						{showBody && <div className="ms-6 mt-1">{body}</div>}
						<Divider />
						<div style={{ width: "100%", display: "flex" }}>
							<div style={{ flex: 1 }}>
								{authorNotCommitter ? (
									<>
										Authored by <b>{rev.c.commit.author.name}</b>, Committed by{" "}
										<b>{rev.c.commit.committer.name}</b>
									</>
								) : (
									<>
										Authored by <b>{rev.c.commit.author.name}</b>
									</>
								)}
							</div>
							<div className="text-end" style={{ flex: 1 }}>
								{FormatTime(Date.parse(rev.c.commit.author.date))}
							</div>
						</div>
						<Divider />
						<div className="w-100 d-flex">
							<Button variant="secondary" onClick={() => setShow(true)}>
								Change Commit...
							</Button>
						</div>
					</div>
				) : (
					<>
						{message && (
							<>
								<span>{message}</span>
								<Divider />
							</>
						)}

						<Button variant="secondary" onClick={() => setShow(true)}>
							Pick Commit...
						</Button>
					</>
				)}
			</Card>
			<Modal show={show} size="xl" onHide={() => setShow(false)}>
				<Modal.Header closeButton>
					<Modal.Title>Pick {header}</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<Row>
						<Col xs={12} className="text-center">
							<div>
								<Select name="Repository" value={repo} setValue={setRepo} allowNull>
									{hasLocalAPI && <option value="local">Your Local Repo</option>}
									{process.env.VITE_GIT_REPO && (
										<option value={process.env.VITE_GIT_REPO}>
											{process.env.VITE_GIT_REPO}
										</option>
									)}
								</Select>
							</div>
							{branches && (
								<div className="mt-2">
									<Select
										name="Branch"
										value={branch}
										setValue={setBranch}
										allowNull
									>
										{branches.map((e) => (
											<option key={e} value={e}>
												{e}
											</option>
										))}
									</Select>
								</div>
							)}
						</Col>
						<Col xs={12} lg={10} className="offset-lg-1 text-center">
							{repo && branch && (
								<>
									<Divider />
									<RevSelector
										shaBranchLookup={shaBranchLookup}
										repo={repo}
										branch={branch}
										onSelect={(commit) => {
											setRev({ c: commit, repo });
											setShow(false);
										}}
									/>
								</>
							)}
						</Col>
					</Row>
				</Modal.Body>
			</Modal>
		</>
	);
}

function RevSelector({
	repo,
	onSelect,
	branch,
	shaBranchLookup,
}: {
	repo: string;
	onSelect: (g: GitCommit) => void;
	branch: string;
	shaBranchLookup: Record<string, string[]>;
}) {
	const [revs, setRevs] = useState<Array<GitCommit>>([]);
	const [filteredRevs, setFilteredRevs] = useState<Array<GitCommit>>([]);

	// We have the option of filtering returned revisions according to only those that
	// affect a specific file. Sounds useful.
	const [collection, setCollection] = useState<string | null>(null);

	useEffect(() => {
		(async () => {
			if (repo.startsWith("GitHub:")) {
				setRevs([]);
				const repoName = repo.slice("GitHub:".length);

				const params = new URLSearchParams();

				if (collection) {
					params.set("path", `seeds/collections/${collection}`);
				} else {
					params.set("path", "seeds/collections");
				}

				const res = await fetch(
					`https://api.github.com/repos/${repoName}/commits?${params.toString()}`
				).then((r) => r.json());

				setRevs(res);
			} else {
				setRevs([]);

				const params = new URLSearchParams();
				params.set("branch", branch);

				if (collection) {
					params.set("file", collection);
				}

				// local
				const res = await APIFetchV1<Array<GitCommit>>(
					`/seeds/commits?${params.toString()}`
				);

				if (!res.success) {
					throw new Error(`Failed to fetch commits? ${res.description}`);
				}

				const hasUncommittedRes = await APIFetchV1<boolean>(
					"/seeds/has-uncommitted-changes"
				);

				if (hasUncommittedRes.success && hasUncommittedRes.body) {
					const LOCAL_COMMIT: GitCommit = {
						sha: "WORKING_DIRECTORY",
						commit: {
							author: {
								name: "Not Committed Yet",
								date: "1970-01-01",
								email: "null@example.com",
							},
							committer: {
								name: "Not Committed Yet",
								date: "1970-01-01",
								email: "null@example.com",
							},
							message: "Uncommitted changes on your local disk.",
						},
						parents: res.body[0] ? [{ sha: res.body[0].sha }] : [],
					};

					setRevs([LOCAL_COMMIT, ...res.body]);
				} else {
					setRevs(res.body);
				}
			}
		})();
	}, [repo, branch, collection]);

	useEffect(() => {
		setFilteredRevs(revs);
		setSearch("");
	}, [revs]);

	const [search, setSearch] = useState("");

	useEffect(() => {
		if (search === "") {
			return setFilteredRevs(revs);
		}

		const regexpSearch = new RegExp(EscapeStringRegexp(search), "ui");

		// remarkably lazy search implementation, but convenient.
		return setFilteredRevs(
			revs.filter(
				(r) =>
					r.sha.match(regexpSearch) ||
					r.commit.message.match(regexpSearch) ||
					r.commit.author.name.match(regexpSearch) ||
					r.commit.committer.name.match(regexpSearch)
			)
		);
	}, [search]);

	return (
		<>
			<div>
				<Select
					name="Show changes that affect:"
					value={collection}
					setValue={setCollection}
					unselectedName="Any Collection"
					allowNull
					className="mx-2"
					style={{ width: "unset", display: "inline" }}
				>
					{DatabaseSeedNames.map((e) => (
						<option key={e} value={e}>
							{e}
						</option>
					))}
				</Select>
			</div>
			<Divider />
			<FormInput
				fieldName="Search"
				placeholder="Search commits..."
				value={search}
				setValue={setSearch}
			/>
			<Divider />
			<div className="timeline timeline-2">
				<div className="timeline-bar"></div>
				{filteredRevs.map((r) => (
					<RevisionComponent
						tags={shaBranchLookup[r.sha] ?? []}
						key={r.sha}
						rev={r}
						onSelect={onSelect}
					/>
				))}
			</div>
		</>
	);
}

function RevisionComponent({
	rev,
	tags = [],
	onSelect: onSelect,
}: {
	rev: GitCommit;
	tags?: string[];
	onSelect: (g: GitCommit) => void;
}) {
	const authorNotCommitter = rev.commit.author.email !== rev.commit.committer.email;

	// if there's a body then there's two newlines.
	const [subject, _gap, ...maybeBodies] = rev.commit.message.split("\n");

	const [showBody, setShowBody] = useState(false);

	const body: string | undefined = maybeBodies?.join("\n");

	return (
		<div className="timeline-item">
			<span className="timeline-badge bg-primary"></span>
			<div className="timeline-content flex-lg-row align-items-start justify-content-between">
				<div className="me-3" style={{ width: "70%", textAlign: "left" }}>
					<span style={{ fontSize: "1.15rem" }}>
						<code>{TruncateString(rev.sha, 9)}</code>:{" "}
						<a
							className="text-decoration-none cursor-pointer"
							onClick={() => onSelect(rev)}
						>
							{subject}
						</a>
					</span>
					{body && (
						<span
							className="ms-4 badge bg-secondary"
							onClick={() => setShowBody(!showBody)}
						>
							{showBody ? (
								<Icon style={{ fontSize: "0.7rem" }} type="chevron-down" />
							) : (
								<Icon style={{ fontSize: "0.7rem" }} type="chevron-left" />
							)}
						</span>
					)}
					{tags.length !== 0 && (
						<span className="ms-2">
							{tags.map((e) => (
								<Badge className="ms-2" bg="primary" key={e}>
									{e}
								</Badge>
							))}
						</span>
					)}
					{showBody && <div className="ms-6 mt-1">{body}</div>}
					<div>
						{authorNotCommitter ? (
							<>
								Authored by <b>{rev.commit.author.name}</b>, Committed by{" "}
								<b>{rev.commit.committer.name}</b>
							</>
						) : (
							<>
								Authored by <b>{rev.commit.author.name}</b>
							</>
						)}
					</div>
				</div>

				<span className="text-body-secondary fst-italic align-self-end">
					{FormatTime(Date.parse(rev.commit.author.date))}
				</span>
			</div>
		</div>
	);
}
