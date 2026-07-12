import Icon from "#components/util/Icon";
import LinkButton from "#components/util/LinkButton";

export function SearchButton() {
	return (
		<LinkButton
			aria-label="Search"
			className="h-14 w-14 px-4 d-flex align-items-center display-6 text-body-secondary"
			to="/search"
			variant="clear"
		>
			<Icon type="search" />
		</LinkButton>
	);
}
