import BackgroundImage from "#components/layout/misc/BackgroundImage";
import { BackgroundContextProvider } from "#context/BackgroundContext";
import { WindowContext } from "#context/WindowContext";
import { type JustChildren } from "#types/react";
import { useContext } from "react";
import Container from "react-bootstrap/Container";

import { Footer } from "./footer/Footer";
import Header from "./header/Header";
import { SubHeader } from "./subheader/SubHeader";

export type LayoutStyles = {
	backgroundHeight: number;
	headerHeight: number;
};

export function Layout({ children }: JustChildren) {
	const {
		breakpoint: { isLg },
	} = useContext(WindowContext);
	const styles: LayoutStyles = {
		backgroundHeight: isLg ? 200 : 125,
		headerHeight: isLg ? 80 : 55,
	};
	return (
		<div className="d-flex flex-column overflow-x-hidden min-vh-100" id="main-wrapper">
			<Header styles={styles} />

			<BackgroundContextProvider>
				<BackgroundImage styles={styles} />
				<SubHeader styles={styles} />

				<Container as="main" className="mt-8 d-flex flex-column flex-grow-1">
					{children}
				</Container>
			</BackgroundContextProvider>

			<Footer />
		</div>
	);
}
