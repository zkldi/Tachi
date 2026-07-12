import { ColourConfig } from "#lib/config";
import { ChangeOpacity } from "#util/color-opacity";
import React, { type CSSProperties } from "react";
import ReactSelectAsync from "react-select/async";
import { COLOUR_SET } from "tachi-common";

export default function AsyncSelect<T extends string | null>(
	args: Parameters<typeof ReactSelectAsync>[0],
) {
	return (
		<ReactSelectAsync
			cacheOptions
			styles={{
				control: (baseStyles: CSSProperties, state: { isFocused: boolean }) => ({
					...baseStyles,
					borderColor: state.isFocused ? "#f38eb7" : "var(--bs-tertiary-bg)",
				}),
			}}
			/*@ts-expect-error borderRadius wants a number but it **will** take a css variable */
			theme={(theme) => ({
				...theme,
				borderRadius: "var(--bs-border-radius)",
				colors: {
					danger: COLOUR_SET.red,
					dangerLight: COLOUR_SET.pink,
					neutral0: "var(--bs-tertiary-bg)",
					neutral5: "var(--bs-secondary-bg)",
					neutral10: "var(--bs-secondary-bg)",
					neutral20: "var(--bs-body-color)",
					neutral30: "var(--bs-body-color)",
					neutral40: "var(--bs-body-color)",
					neutral50: "var(--bs-body-color)",
					neutral60: "var(--bs-body-color)",
					neutral70: "var(--bs-body-color)",
					neutral80: "var(--bs-body-color)",
					neutral90: "var(--bs-body-color)",
					primary: ColourConfig.primary,
					primary25: ChangeOpacity(ColourConfig.primary, 0.25),
					primary50: ChangeOpacity(ColourConfig.primary, 0.5),
					primary75: ChangeOpacity(ColourConfig.primary, 0.75),
				},
			})}
			{...args}
		/>
	);
}
