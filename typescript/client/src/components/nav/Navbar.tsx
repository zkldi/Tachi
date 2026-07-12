import Icon from "#components/util/Icon";
import { debounce, type DebouncedFunc } from "lodash";
import React, {
	cloneElement,
	type KeyboardEventHandler,
	type ReactElement,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { Link, type LinkProps, useLocation } from "react-router-dom";

export interface NavbarItemProps extends LinkProps<HTMLAnchorElement> {
	to: string;
	children: string;
	/**
	 * An array of other pathnames that should trigger an active item
	 */
	otherMatchingPaths?: Array<string>;
}

export type NavbarItem = ReactElement<NavbarItemProps>;

export interface NavbarProps {
	children: ReactElement<NavbarItemProps> | ReactElement<NavbarItemProps>[];
}

export default function Navbar({ children }: NavbarProps) {
	const location = useLocation();

	const navRef = useRef<HTMLDivElement>(null);
	const itemsListRef = useRef<HTMLDivElement>(null);

	const [mounted, setMounted] = useState(false);
	const [indicatorStyle, setIndicatorStyle] = useState({
		left: 0,
		width: 0,
	});
	const [showScrollLeft, setShowScrollLeft] = useState(false);
	const [showScrollRight, setShowScrollRight] = useState(false);

	const links = useMemo(
		() =>
			Array.isArray(children)
				? children.map((el) => {
						const to = el.props.to;
						if (!to) {
							return [];
						}
						const basePath =
							to[to.length - 1] === "/" ? to.substring(0, to.length - 1) : to;

						if (el.props.otherMatchingPaths) {
							return [basePath, ...el.props.otherMatchingPaths];
						}
						return [basePath];
					})
				: children.props.to
					? [[children.props.to]]
					: [[]],
		[children],
	);

	const activeLocIndex = useMemo(() => {
		const loc = location.pathname.split(/([#?]|\/$)/u)[0];
		let locIndex = 0;
		for (let i = 0; i < links.length; i++) {
			const matchingPaths = links[i];
			if (matchingPaths.some((path) => loc.startsWith(path))) {
				locIndex = i;
				// break; THIS IS DELIBERATE TO AVOID / matching everything
			}
		}
		return locIndex;
	}, [links, location]);

	const items = React.Children.map(children, (child, index) => {
		if (!React.isValidElement(child)) {
			return null;
		}
		if (import.meta.env.VITE_IS_DEVELOPMENT) {
			if (child.type === React.Fragment) {
				console.error("The navbar doesn't accept React fragments; Pass an array instead");
			}
		}
		return cloneElement(child, {
			key: child.key || index,
			"aria-selected": index === activeLocIndex,
			role: "tab",
			draggable: false,
			className: "tachi-navbar-item",
		});
	});

	const scrollButtons = (
		<>
			{(showScrollLeft || showScrollRight) && (
				<>
					<button
						aria-hidden
						aria-label="Scroll Navbar Left"
						className="tachi-navbar-button-left"
						hidden={!showScrollLeft}
						onClick={() => handleScrollButton()}
						tabIndex={-1}
					>
						<Icon type="chevron-left" />
					</button>
					<button
						aria-hidden
						aria-label="Scroll Navbar Right"
						className="tachi-navbar-button-right"
						hidden={!showScrollRight}
						onClick={() => handleScrollButton(true)}
						tabIndex={-1}
					>
						<Icon type="chevron-right" />
					</button>
				</>
			)}
		</>
	);

	const nav = navRef.current;
	const itemsList = itemsListRef.current;
	const activeElement = itemsList?.children[activeLocIndex];

	const updateIndicator = () => {
		if (nav && activeElement) {
			const navRect = nav.getBoundingClientRect();
			const activeElementRect = activeElement.getBoundingClientRect();

			setIndicatorStyle({
				left: activeElementRect.left - navRect.left + nav.scrollLeft,
				width: activeElementRect.width,
			});
		}
	};

	const scrollActiveElementIntoView = debounce(
		() => {
			if (nav && itemsList && activeElement) {
				if (itemsList.clientWidth > nav.clientWidth) {
					const childRect = activeElement.getBoundingClientRect();
					const navRect = nav.getBoundingClientRect();

					const left = childRect.left - navRect.left + nav.scrollLeft;
					const right = left + childRect.width;

					if (left <= nav.scrollLeft || right >= nav.scrollLeft + nav.clientWidth) {
						// ScrollIntoView is seemingly broken in Chromium so we will do it ourselves
						requestAnimationFrame(() => {
							if (left < nav.scrollLeft) {
								nav.scrollTo({ left });
							} else if (right > nav.scrollLeft + nav.clientWidth) {
								nav.scrollTo({ left: right - nav.clientWidth });
							}
						});
					}
				}
			}
		},
		125,
		{ trailing: true },
	);

	const handleScrollButton = (right = false) => {
		if (nav && itemsList) {
			const scrollSize = Array.from(itemsList.children).reduceRight(
				(accumulator: number, item, index) => {
					if (accumulator + item.clientWidth > nav.clientWidth) {
						if (index === 0) {
							return nav.clientWidth;
						}
					}
					return accumulator + item.clientWidth;
				},
				0,
			);
			nav.scrollTo({
				left: (nav.scrollLeft += right ? scrollSize : -scrollSize),
			});
		}
	};

	const handleKeyDown: KeyboardEventHandler<HTMLDivElement> = (event) => {
		type Tab = HTMLAnchorElement | null;

		if (!itemsList) {
			return;
		}

		const currentFocus = itemsList.ownerDocument.activeElement;

		if (!currentFocus) {
			return;
		}

		const previous = currentFocus.previousElementSibling as Tab;
		const next = currentFocus.nextElementSibling as Tab;
		const first = itemsList.firstElementChild as Tab;
		const last = itemsList.lastElementChild as Tab;

		switch (event.key) {
			case "ArrowLeft":
				event.preventDefault();
				if (currentFocus === itemsList.firstElementChild) {
					last?.focus();
				} else {
					previous?.focus();
				}
				break;
			case "ArrowRight":
				event.preventDefault();
				if (currentFocus === itemsList.lastElementChild) {
					first?.focus();
				} else {
					next?.focus();
				}
				break;
			case "Home":
				event.preventDefault();
				first?.focus();
				break;
			case "End":
				event.preventDefault();
				last?.focus();
				break;
			default:
				break;
		}
	};

	// needing this just to properly render the component is truly beyond my understanding
	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!nav || !itemsList) {
			return;
		}

		updateIndicator();
		scrollActiveElementIntoView();

		const debouncedUpdateIndicator = debounce(updateIndicator, 75, { trailing: true });

		const debounceIntersectOptions = [125, { leading: true }] as const;
		const handleFirstIntersect: DebouncedFunc<IntersectionObserverCallback> = debounce(
			(entries) => setShowScrollLeft(!entries[0].isIntersecting),
			...debounceIntersectOptions,
		);
		const handleLastIntersect: DebouncedFunc<IntersectionObserverCallback> = debounce(
			(entries) => setShowScrollRight(!entries[0].isIntersecting),
			...debounceIntersectOptions,
		);

		const observeChildren = () => {
			if (
				itemsList.children.length > 1 &&
				itemsList.firstElementChild &&
				itemsList.lastElementChild
			) {
				firstObserver.observe(itemsList.firstElementChild);
				lastObserver.observe(itemsList.lastElementChild);
			}
		};

		/**
		 * handles observations whenever mutations may happen
		 *
		 * I'm not convinced we need this but the previously used mui navbar uses a mutation observer
		 * so i thought it would be safe to do the same in case there's a chance a conditional item changes during render
		 */
		const handleMutation: MutationCallback = (mutations) => {
			firstObserver.disconnect();
			lastObserver.disconnect();

			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					resizeObserver.observe(node as Element);
				});
				mutation.removedNodes.forEach((node) => {
					resizeObserver.unobserve(node as Element);
				});
			});

			updateIndicator();
			observeChildren();
		};

		const mutationObserver = new MutationObserver(handleMutation);
		mutationObserver.observe(itemsList, { childList: true });

		const resizeObserver = new ResizeObserver(() => {
			debouncedUpdateIndicator();
			scrollActiveElementIntoView();
		});
		Array.from(itemsList.children).forEach((item) => resizeObserver.observe(item));
		resizeObserver.observe(nav);

		const observerOptions = {
			root: nav,
			threshold: 0.75,
		};
		const firstObserver = new IntersectionObserver(handleFirstIntersect, observerOptions);
		const lastObserver = new IntersectionObserver(handleLastIntersect, observerOptions);
		observeChildren();

		return () => {
			scrollActiveElementIntoView.cancel();
			debouncedUpdateIndicator.cancel();
			handleFirstIntersect.cancel();
			handleLastIntersect.cancel();
			mutationObserver.disconnect();
			resizeObserver.disconnect();
			firstObserver.disconnect();
			lastObserver.disconnect();
		};
	}, [activeElement, nav, itemsList]);

	return (
		<div className="d-flex position-relative rounded overflow-hidden px-1">
			<nav className="tachi-navbar" ref={navRef}>
				<div
					className="hstack gap-4 flex-grow-1 justify-content-around "
					onKeyDown={handleKeyDown}
					ref={itemsListRef}
					role="tablist"
				>
					{items}
				</div>
				<div
					className="tachi-navbar-indicator"
					hidden={!mounted || indicatorStyle.width === 0}
					style={indicatorStyle}
				/>
			</nav>
			{scrollButtons}
		</div>
	);
}

/**
 * Exposes a React Router Link component accepting otherMatchingPaths
 */
export const NavbarItem = React.forwardRef<HTMLAnchorElement, NavbarItemProps>(
	/* we don't want to pass otherMatchingPaths to the Link component
	 it is still seen by the navbar and processed accordingly */

	({ otherMatchingPaths, ...restProps }, ref) => <Link ref={ref} {...restProps} />,
);

Navbar.Item = NavbarItem;
Navbar.displayName = "NavbarItem";
