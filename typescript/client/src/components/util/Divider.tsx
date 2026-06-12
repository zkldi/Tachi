export default function Divider({ className = "my-4" }: { className?: string }) {
	return (
		<div
			className={`border-bottom border-body-tertiary border-opacity-75 ${className ?? ""}`}
		></div>
	);
}
