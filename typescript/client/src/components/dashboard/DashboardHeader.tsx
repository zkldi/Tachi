import Navbar from "#components/nav/Navbar";

export function DashboardHeader() {
	const navItems = [
		<Navbar.Item key="activity" to="/">
			Activity
		</Navbar.Item>,
		<Navbar.Item key="calendar" to="/calendar">
			Calendar
		</Navbar.Item>,
		<Navbar.Item key="profiles" to="/profiles">
			Your Profiles
		</Navbar.Item>,
		<Navbar.Item key="global-activity" to="/global-activity">
			Global Activity
		</Navbar.Item>,
	];

	return <Navbar>{navItems}</Navbar>;
}
