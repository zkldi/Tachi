import styles from "./QuestProgressBar.module.scss";

/** Renders a themed track + fill for quest / questline completion (0–100%). */
export default function QuestProgressBar({
	percent,
	"aria-label": ariaLabel,
	className,
}: {
	"aria-label"?: string;
	className?: string;
	percent: number;
}) {
	const clamped = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
	const active = clamped > 0 && clamped < 100;

	return (
		<div
			aria-label={ariaLabel}
			aria-valuemax={100}
			aria-valuemin={0}
			aria-valuenow={Math.round(clamped)}
			className={`${styles.track} ${className ?? ""}`}
			role="progressbar"
		>
			<div
				className={`${styles.fill} ${active ? styles.fillActive : ""}`}
				style={{ width: `${clamped}%` }}
			/>
		</div>
	);
}
