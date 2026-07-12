import { type JustChildren } from "#types/react";

export default function DropdownStructure({
	buttons,
	children,
}: {
	buttons: React.ReactNode;
} & JustChildren) {
	return (
		<div className="p-2">
			<div className="row h-100 mb-0 align-items-center">
				<div className="col-3 col-xl-2">
					<div className="btn-group-vertical">{buttons}</div>
				</div>

				<div className="col-9 col-xl-10">
					<div className="row mb-0">{children}</div>
				</div>
			</div>
		</div>
	);
}
