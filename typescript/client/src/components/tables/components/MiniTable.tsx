import { type JustChildren } from "#types/react";
import { type integer } from "tachi-common";

export default function MiniTable({
	className = "",
	children,
	headers,
	colSpan = 1,
}: { className?: string; colSpan?: integer | integer[]; headers?: string[] } & JustChildren) {
	return (
		<table className={`table table-hover table-striped text-center ${className}`}>
			{headers && (
				<thead>
					<tr>
						{headers.map((e, i) => (
							<th colSpan={Array.isArray(colSpan) ? colSpan[i] : colSpan} key={i}>
								{e}
							</th>
						))}
					</tr>
				</thead>
			)}
			<tbody>{children}</tbody>
		</table>
	);
}
