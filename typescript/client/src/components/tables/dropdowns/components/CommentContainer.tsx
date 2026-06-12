export default function CommentContainer({ comment }: { comment: string | null }) {
	if (!comment) {
		return null;
	}

	return (
		<div className="col-12">
			<em>"{comment}"</em>
		</div>
	);
}
