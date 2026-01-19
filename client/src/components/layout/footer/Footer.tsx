import { APIFetchV1 } from "util/api";
import ExternalLink from "components/util/ExternalLink";
import { BannedContext } from "context/BannedContext";
import React, { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ServerStatus } from "types/api-returns";
import Nav from "react-bootstrap/Nav";
import Container from "react-bootstrap/Container";

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
							href="https://en.wikipedia.org/wiki/Dummy_(album)"
							className={linkClassNames}
						>
							{serverVersion}
						</Nav.Link>
					</div>
					<div className="d-flex flex-wrap flex-lg-nowrap justify-content-evenly justify-content-lg-end">
						<Nav.Link
							as={Link}
							to="/support"
							className={linkClassNames}
							onClick={() => window.scrollTo(0, 0)}
						>
							Support
						</Nav.Link>
						<Nav.Link
							as={ExternalLink}
							href="https://docs.tachi.ac/wiki/rules"
							className={linkClassNames}
						>
							Rules
						</Nav.Link>
						<Nav.Link
							as={Link}
							to="/privacy"
							className={linkClassNames}
							onClick={() => window.scrollTo(0, 0)}
						>
							GDPR
						</Nav.Link>
						{process.env.VITE_DISCORD && (
							<Nav.Link
								as={ExternalLink}
								href={process.env.VITE_DISCORD}
								className={linkClassNames}
							>
								Discord
							</Nav.Link>
						)}
						<Nav.Link
							as={ExternalLink}
							href="https://github.com/zkldi/Tachi"
							className={linkClassNames}
						>
							Source Code
						</Nav.Link>
						<Nav.Link
							as={ExternalLink}
							href="https://docs.tachi.ac/"
							className={linkClassNames}
						>
							Developer Documentation
						</Nav.Link>
					</div>
				</Container>
			</Nav>
		</footer>
	);
}
