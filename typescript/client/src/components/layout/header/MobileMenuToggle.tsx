import Icon from "#components/util/Icon";
import { type SetState } from "#types/react";

export default function MobileMenuToggle({
	state,
	setState,
}: {
	setState: SetState<boolean>;
	state: boolean;
}) {
	return (
		<button
			aria-controls="mobile-menu"
			aria-expanded={state}
			aria-label="Toggle Navigation"
			className="d-block d-lg-none h-14 w-14 pt-1 rounded border-0 bg-transparent text-body display-6 focus-visible-ring "
			onClick={() => setState((prevState) => !prevState)}
		>
			<Icon type="bars" />
		</button>
	);
}
