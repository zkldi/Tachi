import Icon from "#components/util/Icon";
import toast from "react-hot-toast";

export function SendErrorToast(text: string) {
	toast.error((t) => (
		<div>
			{text}{" "}
			<span onClick={() => toast.dismiss(t.id)}>
				<Icon type="times" />
			</span>
		</div>
	));
}

export function SendSuccessToast(text: string) {
	toast.success((t) => (
		<div>
			{text}{" "}
			<span onClick={() => toast.dismiss(t.id)}>
				<Icon type="times" />
			</span>
		</div>
	));
}
