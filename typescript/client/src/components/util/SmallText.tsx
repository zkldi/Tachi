export default function SmallText({ small, large }: { large: string; small: string }) {
	return (
		<>
			<span className="d-none d-lg-inline">{large}</span>
			<span className="d-inline d-lg-none">{small}</span>
		</>
	);
}
