export default function FlareCell({ value }: { value: string }) {
	return (
		<td
			style={{
				whiteSpace: "nowrap",
			}}
		>
			<strong>{value}</strong>
		</td>
	);
}
