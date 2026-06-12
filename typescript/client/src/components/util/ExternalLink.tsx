export default function ExternalLink({
	children,
	...props
}: React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>) {
	return (
		<a rel="noopener noreferrer" target="_blank" {...props}>
			{children}
		</a>
	);
}
