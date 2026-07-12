import SignOut from "#components/util/SignOut";
import SiteWordmark from "#components/util/SiteWordmark";
import { UserContext } from "#context/UserContext";
import { WindowContext } from "#context/WindowContext";
import React, { useContext, useEffect, useState } from "react";
import { Navbar, Offcanvas } from "react-bootstrap";
import Container from "react-bootstrap/Container";
import { Link } from "react-router-dom";

import { type LayoutStyles } from "../Layout";
import { HeaderMenu } from "./HeaderMenu";
import Logo from "./Logo";
import MobileMenuToggle from "./MobileMenuToggle";
import UserArea from "./UserArea";

export default function Header({ styles }: { styles: LayoutStyles }) {
	const { user } = useContext(UserContext);
	const {
		breakpoint: { isLg },
	} = useContext(WindowContext);
	const [showMobileMenu, setShowMobileMenu] = useState(false);

	const dropdownMenuStyle = isLg ? { transform: "translateY(1.05rem)" } : undefined;

	const setState = isLg ? undefined : setShowMobileMenu;

	useEffect(() => {
		if (isLg) {
			setShowMobileMenu(false);
		}
	}, [isLg]);
	return (
		<header
			className="bg-body bg-opacity-75 backdrop-blur-xl border-bottom fixed-top border-body-tertiary border-opacity-50"
			id="main-header"
			style={{ height: `${styles.headerHeight}px` }}
		>
			<Navbar className="h-100 p-0" expand={"lg"} variant="">
				<Container className="d-flex align-items-center">
					<Logo />
					<MobileMenuToggle setState={setShowMobileMenu} state={showMobileMenu} />
					<Navbar.Offcanvas
						aria-labelledby="navbar-label"
						id="navbar"
						onHide={() => setShowMobileMenu(false)}
						show={showMobileMenu}
					>
						<Offcanvas.Header className="p-4 border-bottom border-body-tertiary">
							<Link
								className="mx-auto p-2 focus-visible-ring rounded"
								id="home"
								to="/"
							>
								<SiteWordmark id="navbar-label" width="192px" />
							</Link>
						</Offcanvas.Header>
						<Offcanvas.Body className="d-flex flex-column">
							<HeaderMenu dropdownMenuStyle={dropdownMenuStyle} setState={setState} />
						</Offcanvas.Body>
						{user && (
							<div className="d-flex bottom-0 pb-2 px-4 d-lg-none">
								<SignOut className="w-100" />
							</div>
						)}
					</Navbar.Offcanvas>
					<UserArea dropdownMenuStyle={dropdownMenuStyle} user={user} />
				</Container>
			</Navbar>
		</header>
	);
}
