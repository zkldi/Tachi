import ExternalLink from "#components/util/ExternalLink";
import { BannedContext } from "#context/BannedContext";
import { type ServerStatus } from "#types/api-returns";
import { APIFetchV1 } from "#util/api";
import React, { useContext, useEffect, useState } from "react";
import Container from "react-bootstrap/Container";
import Nav from "react-bootstrap/Nav";
import { Link } from "react-router-dom";

export function Footer() {
	const [serverVersion, setServerVersion] = useState("Loading...");
	const { setBanned } = useContext(BannedContext);
	const linkClassNames = "text-body text-opacity-50 text-opacity-100-hover";

	useEffect(() => {
		APIFetchV1<ServerStatus>("/status").then((r) => {
			if (r.statusCode === 403) {
				setBanned(true);
			}

			if (!r.success) {
				setServerVersion("Error Fetching data!");
			} else {
				setServerVersion(r.body.version);
			}
		});
	}, []);

	return (
		<footer className="py-4 border-top border-body-tertiary border-opacity-75 mt-4">
			<Nav>
				<Container className="d-flex flex-column flex-lg-row justify-content-between align-items-center">
					<div className="order-2 order-lg-0 mt-2 m-lg-0">
						<Nav.Link
							as={ExternalLink}
							className={linkClassNames}
							href="https://en.wikipedia.org/wiki/Dummy_(album)"
						>
							{serverVersion}
						</Nav.Link>
					</div>
					<div className="d-flex flex-wrap flex-lg-nowrap justify-content-evenly justify-content-lg-end">
						<Nav.Link
							as={Link}
							className={linkClassNames}
							onClick={() => window.scrollTo(0, 0)}
							to="/support"
						>
							Support
						</Nav.Link>
						<Nav.Link
							as={ExternalLink}
							className={linkClassNames}
							href="https://docs.tachi.ac/wiki/rules"
						>
							Rules
						</Nav.Link>
						<Nav.Link
							as={Link}
							className={linkClassNames}
							onClick={() => window.scrollTo(0, 0)}
							to="/privacy"
						>
							GDPR
						</Nav.Link>
						<Nav.Link
							as={Link}
							className={linkClassNames}
							onClick={() => window.scrollTo(0, 0)}
							to="/credits"
						>
							Credits
						</Nav.Link>
						{import.meta.env.VITE_DISCORD && (
							<Nav.Link
								as={ExternalLink}
								className={linkClassNames}
								href={import.meta.env.VITE_DISCORD}
							>
								Discord
							</Nav.Link>
						)}
						<Nav.Link
							as={ExternalLink}
							className={linkClassNames}
							href="https://github.com/zkldi/Tachi"
						>
							Source Code
						</Nav.Link>
						<Nav.Link
							as={ExternalLink}
							className={linkClassNames}
							href="https://docs.tachi.ac/"
						>
							Developer Documentation
						</Nav.Link>
					</div>
				</Container>
			</Nav>
		</footer>
	);
}
