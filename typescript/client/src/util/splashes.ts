import { Days, Months } from "./misc";
import { FormatDate } from "./time";

export const neutralSplashes = [
	"A Rhythm Game Score Manager",
	"The Rhythm Game Score Manager",
	"I sure hope the employer looking at this thinks I'm cool.",
];

export const loggedInSplashes = [
	"Splash Text Has The Right To Humour",
	"The Score Tracking Man He Sees Everything Like This",
	"'DROP TABLE scores;--",
	"to be continued...",
	"Blessed Data",
	"No Nonsense",
	"Maybe a little nonsense",
	"Mr Worldwide",
	"Ceci n'est pas un splash text",
	"mowgli, loOK OUT",
	"Swish swoosh pew pew",
	"Do you memorise the notes?",
	"All this scratching is making me itch",
	"Pace yourself",
	"What is this, a crossover episode?",
	"npm install humor",
	"OKNOTOK",
	"Unlimited multiplication of money up to 300%!",
	"What happens if I print a dictionary?",
	"Whatever people say I am...",
	"When the four corners of this coccoon collide...",
	"WE CAN DO BETTER",
	"WE WILL DO BETTER",
	"BREAK YOUR NIHILISM",
	"float chordjack = jack * 0.75f;",
	"malicious walls",
	"my computer called cheesebuger",
	"Unban me from Quaver",
	"...we came in?",
	"isn't this where...",
	"You are simply neglecting the law of large numbers.",
	"I'm using tilt controls!",
	"Relax yourself, girl, please set-tle down",
	"Michael Jackson IS Monty Python.",
	"1.01^365",
	"WARNING: That is not falco",
	"it's been one week since ya looked at me",
	"Producing.",
	"IT AIN'T NO EASY GRAB THEY GOT T",
	"AUTOGLASS REPAIR",
	"AUTOGLASS REPLACE",
	"turn on RANDOM!",
	"It is deliberate.",
	"Buy the golden ninja pack!",
	"WITHIN REASON!",
	"Put the maid dress on.",
	"And it just happens to be fantastically enjoyable.",
	"Touch the statue. I will forgive you.",
	"https://github.com/EpicGames/Signup/pull/10",
	"MongoDB is web scale, actually.",
	"▼LTRA ▼IOLENCE EDITION",
	"It's all about the CEO grindset.",
	"through ivy - out middle",
	"The graphics. That's what it's really about.",
	"you could be playing mario galaxy right now",
	"...When yours just crashes?",
	"My Beautiful Score Tracking Fantasy",
	"The Supercharged Score Tracker.",
	"Play ULTRAKILL.",
	"A Cutting-Edge Score Tracker (heh).",
	"Winnipeg is a warm, nice place to live.",
	"I accidentally the score tracker.",
	"~𝒕𝒉𝒆 𝒈𝒆𝒂𝒓𝒔 𝒕𝒖𝒓𝒏 𝒐𝒏𝒄𝒆 𝒎𝒐𝒓𝒆~",
	"<script>alert(1)</script>",
	"come on down",
	"The preparation for a dive is always a tense time.",
	"Music Is Math",
	"The public gets what the public wants!",
	"Our most beautiful melody.",
	"Cwalina Subsidiary",
	"Let's do it now.",
	"Brought by GameMasterAnthony",
	"bwhæhæhææhæhhææhæh",
	"Maximal opinions and Minimal evidence",
	"Who is the scrimbler bimbler?",
	"You wish you knew who the hibble gibble gobbler was.",
	`The current day is ${FormatDate(Date.now())}, probably.`,
	"I have always thought of myself as an ambassador for the dance game community.",
	"When lava pours out near the sea surface, tremendous volcanic explosions sometimes occur.",
	"But thE MOOOOON JUST STAAARED BAACK AAAT MEE",
	"However... I kinda feel like this one's in the bag.",
	"Oh yeah? I can exit vim, buddy.",
	"Discovered Colours",
	"Meeting People Is Easy",
	"See ya later, innovator",
	"bou bou bounce",
	"I CAN'T PUT MY FINGER ON IT",
	"Exactly where you're at",
	"You Are Here -->",
	"I'm thinking this one's brown.",
	"My god is the sun!",
	"...Like Clockwork",
	"brooooyyddg",
	"The coffee isn't even bitter...",
	"...because, what's the difference.",
	"go ahead, ctrl+f the source for the splashes, ruin the fun for yourself.",
	"I'm playing bedwars!",
	"Just tryna t-take it easy and... chill out afterwards",
	"you weren't theerrreee",
	"Is this really happening?",
	"Let's see Paul Allen's score tracker.",
	"You know there's more to shoegaze than just listening to loveless, right?",
	"ok deraadt miod",
	"What good are notebooks?",
	"Ladies and Gentlemen We Are...",
	"Source: It came to me in a dream.",
	"It's called solidarity, you wouldn't get it.",
	"Come to my house and play BMS.",
	"There is a leviathan in play.",
	"Touch Grass.",
	"arch btw",
	"Upon Such Great Heights",
	"Stay a while, and listen!",
	"Unexpected Roads...",
	"Take care of yourself.",
	"Love in all things.",
	"You're trolling?",
	"We teach the users how to cook a full English Breakfast.",
	"95% Faster according to internal testing",
	"How about you 'tachi' some buttons and get good at the video game?",
];

const curTime = new Date();
const localHours = curTime.getHours();
const day = curTime.getDay() as Days;

let timeSplashes = [];

if (localHours < 6) {
	timeSplashes = ["It's late", "It's bedtime", "zzz", "*yawn*"];
} else if (localHours < 12) {
	timeSplashes = ["Good morning", "Good morbing"];
} else if (localHours < 18) {
	timeSplashes = ["Good afternoon"];
} else {
	timeSplashes = ["Good evening"];
}

let daySplashes: Array<string> = [];

switch (day) {
	case Days.Monday:
		daySplashes = ["Happy Monday"];
		break;

	case Days.Tuesday:
	case Days.Wednesday:
	case Days.Sunday:
	case Days.Saturday:
		// Does *anything* interesting happen on these days?
		break;
	case Days.Thursday:
		daySplashes = ["Feliz Jueves"];
		break;
	case Days.Friday:
		daySplashes = ["It's Femboy Friday", "It's finally Friday"];
		break;
}

let holidaySplashes: Array<string> = [];

const curDate = curTime.getDate();
const curMonth = curTime.getMonth();

if (curDate === 25 && curMonth === Months.December) {
	holidaySplashes = ["Merry Christmas", "Happy Holidays", "Happy Christmas"];
} else if (curDate === 1 && curMonth === Months.January) {
	holidaySplashes = ["Happy New Year", `Welcome to ${curTime.getFullYear()}`];
} else if (curDate === 31 && curMonth === Months.October) {
	holidaySplashes = ["Happy Halloween", "Boo", "Get spooked", "ooOooOOooo"];
}

// If there are any holidary splashes ongoing, don't display anything else.
export const heySplashes = holidaySplashes.length
	? holidaySplashes
	: [
			"Welcome back",
			"What's up",
			"Hey",
			"What's poppin",
			"Hello",
			"Hewwo",
			"How's it going",
			"heyyy",
			"Sup",
			"Ahoy",
			"What's crackin'",
			"Howdy",
			"Heya",
			...timeSplashes,
			...daySplashes,
		];
