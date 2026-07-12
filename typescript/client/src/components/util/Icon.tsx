import { type TextColour } from "#types/bootstrap";

export default function Icon({
	type,
	noPad,
	brand,
	colour,
	regular,
	className = "",
	...props
}: {
	brand?: boolean;
	colour?: TextColour;
	noPad?: boolean;
	regular?: boolean;
	type: string;
} & React.HTMLAttributes<HTMLElement>) {
	const iconClassName = `fa${regular ? "r" : brand ? "b" : "s"} fa-${type}${noPad ? " p-0" : ""}${
		colour ? ` text-${colour}` : ""
	}`;
	return <i className={`${iconClassName + (className && " ") + className}`} {...props} />;
}
