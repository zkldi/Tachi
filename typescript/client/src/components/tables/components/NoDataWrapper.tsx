import React from "react";

export default function NoDataWrapper({ children }: { children: JSX.Element[] }) {
	if (children.length === 0) {
		return (
			<tr>
				{/* Slight hack - span at least 100 columns, which is probably what we want. */}
				<td colSpan={100}>
					<span className="text-center">No Data.</span>
				</td>
			</tr>
		);
	}
	return <>{children}</>;
}
