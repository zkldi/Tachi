/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Dispatch, ReactNode, SetStateAction } from "react";

import {
	type FieldHelperProps,
	type FieldInputProps,
	type FieldMetaProps,
	type FormikErrors,
	type FormikState,
	type FormikTouched,
} from "formik";
import { type UserDocument, type V3Game } from "tachi-common";

export interface JustChildren {
	children: ReactNode;
}

export type SetState<T> = Dispatch<SetStateAction<T>>;

/**
 * The formik types don't export this - this is copied directly from there.
 */
export type UseFormik<Values> = {
	dirty: boolean;
	errors: FormikErrors<Values>;
	getFieldHelpers: (name: string) => FieldHelperProps<any>;
	getFieldMeta: (name: string) => FieldMetaProps<any>;
	getFieldProps: (nameOrOptions: any) => FieldInputProps<any>;
	handleBlur: {
		(e: React.FocusEvent<any>): void;
		<T = any>(fieldOrEvent: T): T extends string ? (e: any) => void : void;
	};
	handleChange: {
		(e: React.ChangeEvent<any>): void;
		<T_1 = string | React.ChangeEvent<any>>(
			field: T_1,
		): T_1 extends React.ChangeEvent<any> ? void : (e: string | React.ChangeEvent<any>) => void;
	};
	handleReset: (e: any) => void;
	handleSubmit: (e?: React.FormEvent<HTMLFormElement> | undefined) => void;
	initialErrors: FormikErrors<unknown>;
	initialStatus: any;
	initialTouched: FormikTouched<unknown>;
	initialValues: Values;
	isSubmitting: boolean;
	isValid: boolean;
	isValidating: boolean;
	registerField: (name: string, { validate }: any) => void;
	resetForm: (nextState?: Partial<FormikState<Values>> | undefined) => void;
	setErrors: (errors: FormikErrors<Values>) => void;
	setFieldError: (field: string, value: string | undefined) => void;
	setFieldTouched: (
		field: string,
		touched?: boolean,
		shouldValidate?: boolean | undefined,
	) => Promise<FormikErrors<Values>> | Promise<void>;
	setFieldValue: (
		field: string,
		value: any,
		shouldValidate?: boolean | undefined,
	) => Promise<FormikErrors<Values>> | Promise<void>;
	setFormikState: (
		stateOrCb: ((state: FormikState<Values>) => FormikState<Values>) | FormikState<Values>,
	) => void;
	setStatus: (status: any) => void;
	setSubmitting: (isSubmitting: boolean) => void;
	setTouched: (
		touched: FormikTouched<Values>,
		shouldValidate?: boolean | undefined,
	) => Promise<FormikErrors<Values>> | Promise<void>;
	setValues: (
		values: React.SetStateAction<Values>,
		shouldValidate?: boolean | undefined,
	) => Promise<FormikErrors<Values>> | Promise<void>;
	status?: any;
	submitCount: number;
	submitForm: () => Promise<any>;
	touched: FormikTouched<Values>;
	unregisterField: (name: string) => void;
	validateField: (name: string) => Promise<string | undefined> | Promise<void>;
	validateForm: (values?: Values) => Promise<FormikErrors<Values>>;
	validateOnBlur: boolean;
	validateOnChange: boolean;
	validateOnMount: boolean;
	values: Values;
};

export interface GameProps {
	game: V3Game;
}

export interface GameProfileProps {
	reqUser: UserDocument;
	game: V3Game;
}
