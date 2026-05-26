import { Footer } from "#components/layout/footer/Footer";
import Divider from "#components/util/Divider";
import LinkButton from "#components/util/LinkButton";
import { TachiConfig } from "#lib/config";
import { ToCDNURL } from "#util/api";
import { DEFAULT_GAME_BANNER_REL_PATH } from "#util/game-group-banner-counts";
import React from "react";

// This page is currently unused,
// It's alright, but hey, we could do more.
export default function LandingPage() {
	return (
		<>
			{/* <HeaderMobile /> */}
			{/* <Header /> */}
			<div className="landing-page" id="kt_content">
				<section className="hero" id="hero">
					<div
						className="hero-bg-image"
						style={{
							backgroundImage: `url(${ToCDNURL(DEFAULT_GAME_BANNER_REL_PATH)})`,
						}}
					/>
					<div
						className="hero-bg-fader"
						style={{
							backgroundImage: `url(${ToCDNURL("/misc/overlay.png")})`,
						}}
					/>
					<div className="hero-content-wrapper">
						<div className="row">
							<div className="col-12 col-lg-8 offset-lg-2 d-flex align-items-center">
								<div className="row justify-content-center text-center">
									<div className="col-12 mb-8">
										<div className="d-none d-lg-block">
											<img
												alt={TachiConfig.NAME}
												src={ToCDNURL("/logos/logo-wordmark.png")}
												width="30%"
											/>
										</div>
										<div className="d-block d-lg-none">
											<img
												alt={TachiConfig.NAME}
												src={ToCDNURL("/logos/logo-wordmark.png")}
												width="80%"
											/>
										</div>
									</div>
									<div className="col-12">
										<h3 className="display-3">
											A <b>Supercharged</b> Score Tracker
										</h3>
									</div>
								</div>
							</div>
						</div>
					</div>
				</section>
				<Divider className="mt-8 mb-16" />
				<section className="features" id="features">
					<div className="container">
						<div className="row">
							<FeatureContainer
								description={`${TachiConfig.NAME} analyses your scores for you, showing all the statistics you'll ever want to see.`}
								tagline="No More Spreadsheets."
							>
								<FeatureImage
									alt="Picture of scores."
									src={ToCDNURL("/hero/scores.png")}
								/>
							</FeatureContainer>
							<FeatureContainer
								description={`${TachiConfig.NAME} implements the features rhythm gamers already talk about. Break your scores down into sessions, Track goals in real time, break down your folder averages - it's all there!`}
								leftAlign={false}
								tagline="Features You'll Actually Use."
							>
								foo
							</FeatureContainer>
							<FeatureContainer
								description={`${TachiConfig.NAME} supports a bunch of your favourite games, and integrates with many existing services to make sure no score is lost to the void.`}
								tagline="All Your Scores."
							>
								foo
							</FeatureContainer>
							<div
								className="col-12 text-center"
								style={{ paddingTop: 100, height: 250 }}
							>
								But hey, this all sounds a bit formal. Let's be honest, if you're a
								rhythm gamer, you probably don't need to be sold on this like it's a
								startup :P.
								<br />
								<LinkButton className="mt-4 btn-outline-primary" to="/register">
									Register?
								</LinkButton>
							</div>
						</div>
					</div>
				</section>
			</div>
			<Footer />
		</>
	);
}

function FeatureContainer({
	tagline,
	description,
	children,
	leftAlign = true,
}: {
	children: React.ReactChild;
	description: string;
	leftAlign?: boolean;
	tagline: string;
}) {
	return (
		<div className="col-12 mb-16">
			<div className="row">
				{leftAlign && (
					<div className="col-12 col-lg-6 align-self-center">
						<h1 className="display-4">{tagline}</h1>
						<h5>{description}</h5>
					</div>
				)}
				<div className="col-12 d-none d-lg-block col-lg-6 text-center">{children}</div>
				{!leftAlign && (
					<div className="col-12 col-lg-6 text-end">
						<h1 className="display-4">{tagline}</h1>
						<h5>{description}</h5>
					</div>
				)}
			</div>
		</div>
	);
}

function FeatureImage({ src, alt }: { alt: string; src: string }) {
	return <img alt={alt} src={src} />;
}
