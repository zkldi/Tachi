export default function DebugContent({ data }: { data: unknown }) {
	return (
		<textarea
			className="w-100 font-monospace"
			readOnly
			style={{ height: "400px" }}
			value={JSON.stringify(data, null, 4)}
		/>
	);
}
