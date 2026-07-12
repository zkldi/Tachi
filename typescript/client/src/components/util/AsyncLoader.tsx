import Async from "react-async";

import Loading from "./Loading";

export default function AsyncLoader<T = unknown>({
	promiseFn,
	promise,
	children,
}: {
	children: (data: T) => string | (string | JSX.Element)[] | JSX.Element | null;
	promise?: Promise<T>;
	promiseFn?: () => Promise<T>;
}) {
	const Component = children;
	return (
		<Async promise={promise} promiseFn={promiseFn}>
			<Async.Pending>
				<Loading />
			</Async.Pending>
			<Async.Rejected>
				{(error) => (
					<div className="text-center">
						Fatal Error: {error.message}. That's not good!
					</div>
				)}
			</Async.Rejected>
			{/* @ts-expect-error come on */}
			<Async.Fulfilled>{(data) => Component(data)}</Async.Fulfilled>
		</Async>
	);
}
