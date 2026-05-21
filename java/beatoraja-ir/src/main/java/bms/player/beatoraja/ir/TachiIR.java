package bms.player.beatoraja.ir;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Properties;

import javax.swing.JDialog;
import javax.swing.JOptionPane;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectWriter;

import bms.player.beatoraja.MainController;
import bms.player.beatoraja.ScoreData;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

// thank you to Seraphin- for this code.
// I have modified it for my own ends, but the same base is here.

public class TachiIR implements IRConnection {

	public static final String BEATORAJA_CLIENT_VERSION = MainController.getVersion();

	// These variables need to be static and have those specific visibilities
	// They're read by beatoraja through reflection
	public static final String NAME;
	public static final String HOME;
	public static final String VERSION;
	private static final String BASE_URL;
	private static final OkHttpClient HTTP_CLIENT = new OkHttpClient();
	private static final ObjectMapper MAPPER = new ObjectMapper();

	static {
		var properties = new Properties();
		var classLoader = Thread.currentThread().getContextClassLoader();
		try (var inputStream = classLoader.getResourceAsStream("tachi.properties")) {
			properties.load(inputStream);
		} catch (IOException ex) {
			panic();
		}
		NAME = properties.getProperty("tachi.ir.name");
		HOME = properties.getProperty("tachi.ir.home");
		VERSION = properties.getProperty("tachi.ir.version");
		BASE_URL = properties.getProperty("tachi.ir.baseUrl");
	}

	enum Importance {
		DEBUG,
		INFO,
		WARNING,
		ERROR
	}

	private String apiToken = "";

	class ResponseCreator<T> {
		public IRResponse<T> create(final boolean success, final String msg, final T data) {
			return new IRResponse<T>() {
				public boolean isSucceeded() {
					return success;
				}

				public String getMessage() {
					return msg;
				}

				public T getData() {
					return data;
				}
			};
		}
	}

	class TachiResponse {
		boolean success;
		String description;
		JsonNode body;
		int statusCode;

		TachiResponse(JsonNode actualObj, int code) {
			success = actualObj.path("success").asBoolean(false);
			description = actualObj.path("description").asText("Unknown response.");
			body = actualObj.path("body");
			statusCode = code;
		}
	}

	class FailedTachiResponse {
		boolean success;
		String description;

		FailedTachiResponse(JsonNode actualObj) {
			success = actualObj.get("success").asBoolean();
			description = actualObj.get("description").asText();
		}
	}

	/**
	 * Makes a GET request to BASE_URL + url.
	 */
	TachiResponse GETRequest(String url) throws Exception {
		Request request = new Request.Builder().url(BASE_URL + url).header("User-Agent", "OKHTTP")
				.header("X-TachiIR-Version", VERSION).addHeader("Authorization", "Bearer " + apiToken)
				.addHeader("Accept", "application/json").build();

		try (Response response = HTTP_CLIENT.newCall(request).execute()) {
			int code = response.code();
			String responseBody = response.body() == null ? "" : response.body().string();
			JsonNode actualObj = responseBody.isEmpty()
					? MAPPER.createObjectNode().put("success", false).put("description", "Empty response.")
					: MAPPER.readTree(responseBody);

			return new TachiResponse(actualObj, code);
		}
	}

	/**
	 * Makes a POST request to BASE_URL + url. Sends the 2nd argument as the request
	 * body.
	 */
	TachiResponse POSTRequest(String url, String JSON) throws Exception {
		// charset=utf-8 is redundant, but is here just incase.
		RequestBody body = RequestBody.create(MediaType.get("application/json; charset=utf-8"), JSON);

		Request request = new Request.Builder().url(BASE_URL + url).header("User-Agent", "OKHTTP")
				.header("X-TachiIR-Version", VERSION).addHeader("Accept", "application/json")
				.addHeader("Authorization", "Bearer " + apiToken).post(body).build();

		try (Response response = HTTP_CLIENT.newCall(request).execute()) {
			int code = response.code();
			String responseBody = response.body() == null ? "" : response.body().string();
			JsonNode actualObj = responseBody.isEmpty()
					? MAPPER.createObjectNode().put("success", false).put("description", "Empty response.")
					: MAPPER.readTree(responseBody);

			return new TachiResponse(actualObj, code);
		}
	}

	/**
	 * Utility wrapper for logging to stdout.
	 */
	private void log(String message, Importance imp) {
		String msg = "[" + NAME + "] (" + VERSION + ") " + message;
		System.out.println(msg);

		// COMMENTED OUT: This does not work -- it's impossible to obtain a reference to
		// the in game
		// message renderer.
		// // if worse than debug
		// if (imp.compareTo(Importance.DEBUG) > 0) {
		// Color colour;

		// if (imp == Importance.ERROR) {
		// colour = Color.RED;
		// } else if (imp == Importance.WARNING) {
		// colour = Color.GOLD;
		// } else if (imp == Importance.DEBUG) {
		// colour = Color.BLUE;
		// } else {
		// colour = Color.GRAY;
		// }

		// msgRenderer.addMessage(msg, colour, 0);
		// }
	}

	/**
	 * Utility wrapper for throwing a generic exception.
	 */
	private void _throw() throws Exception {
		throw new Exception("An internal error has occurred.");
	}

	/**
	 * Since we extend/implement a class with the IR, we're not allowed to use the
	 * "throws exception" function signature modifier.
	 *
	 * This is the only way to throw errors, and is generally a horrific idea. Ah
	 * well.
	 */
	private static void panic() {
		throw new RuntimeException(
				"This build of TachiIR is critically broken. Report this, or check the logs above to see if it was your fault.");
	}

	public IRResponse<IRPlayerData> register(IRAccount account) {
		ResponseCreator<IRPlayerData> rc = new ResponseCreator<IRPlayerData>();
		return rc.create(false, "Registration is handled on the Tachi website.", null);
	}

	private String username;

	/**
	 * Basically does nothing. Performs some init and status checks for the IR.
	 *
	 * Authentication is already handled with API keys, and users are expected to
	 * place their relevant API key inside `password`.
	 */
	public IRResponse<IRPlayerData> login(IRAccount account) {
		if (BASE_URL.equals("")) {
			log("No BASE_URL. This build of TachiIR is likely to be broken. Report this.", Importance.ERROR);
			panic();
		}

		Boolean isWindows = System.getProperty("os.name").startsWith("Windows");
		String fixInfo = isWindows ? "You can skip this warning by adding 'set SHUT_UP_TACHI=yes' to your .bat file."
				: "You can skip this warning by adding 'export SHUT_UP_TACHI=yes' to your .command file.";

		String jdkVendor = System.getProperty("java.vendor").toLowerCase();

		if (System.getenv("SHUT_UP_TACHI") == null &&
				!jdkVendor.contains("liberica")) {
			final JDialog dialogThatForcesAlwaysOnTop = new JDialog();
			dialogThatForcesAlwaysOnTop.setAlwaysOnTop(true);

			if (BEATORAJA_CLIENT_VERSION.toLowerCase().startsWith("beatoraja")) {
				String msg = "You are playing on beatoraja.\n"
						+ "PMS (9KEY) scores will submit to the " + NAME + ".\n"
						+ "BMS (7KEY and 14KEY) scores WILL NOT SUBMIT to the " + NAME
						+ ", as the only allowed client is lr2oraja.\nIf confused, google 'lr2oraja' for install instructions.\n"
						+ fixInfo;

				log(msg, Importance.WARNING);
				JOptionPane.showMessageDialog(dialogThatForcesAlwaysOnTop, msg, "IR Client Warning",
						JOptionPane.WARNING_MESSAGE);
			} else if (BEATORAJA_CLIENT_VERSION.toLowerCase().startsWith("lr2oraja")) {
				String msg = "You are playing on LR2oraja.\n"
						+ "BMS (7KEY, 14KEY) scores will submit to the " + NAME + ".\n"
						+ "PMS (9KEY) scores WILL NOT SUBMIT to the " + NAME
						+ ", as the only allowed client is beatoraja.\n"
						+ fixInfo;

				log(msg, Importance.WARNING);
				JOptionPane.showMessageDialog(dialogThatForcesAlwaysOnTop, msg, "IR Client Warning",
						JOptionPane.WARNING_MESSAGE);
			}
		}

		ResponseCreator<IRPlayerData> rc = new ResponseCreator<IRPlayerData>();

		// We grab the apiToken from the users password. Their username doesn't actually
		// matter.
		// This is for separation of authentication concerns.
		apiToken = account.password;

		try {
			TachiResponse resp = GETRequest("/api/v1/status?echo=lr2oraja-ir");
			JsonNode userBody = MAPPER.createObjectNode();

			if (resp.success) {
				log("Connected to " + BASE_URL + ".", Importance.DEBUG);

				username = resp.body.get("whoami").asText();

				TachiResponse userResp = GETRequest("/api/v1/users/" + username);
				log("Sending request to /api/v1/users/" + username, Importance.INFO);

				if (userResp.success) {
					userBody = userResp.body;
					log("Authenticated as " + userResp.body.get("username").asText() + ".", Importance.INFO);
				} else {
					log("Failed to find out who you are. Can't login!", Importance.ERROR);
					_throw();
				}
			} else {
				log("An error has occurred in logging in. Please make sure that you are putting an API Key in your password field, and not your site login password.",
						Importance.ERROR);
				_throw();
			}

			IRPlayerData playerData = new IRPlayerData(
					userBody.path("id").asText(username),
					userBody.path("username").asText(username),
					"");

			return rc.create(resp.success, resp.description, playerData);
		} catch (Exception e) {
			System.out.println(e.toString());
			return rc.create(false, "Internal Exception", null);
		}
	}

	class PlayData {
		public IRChartData chart;
		public IRScoreData score;
		public String client;

		PlayData(IRChartData model, IRScoreData scoreData) {
			chart = model;
			score = scoreData;
			client = MainController.getVersion();
		}
	}

	/**
	 * Submits a score to the IR. This POSTs data out to submit-score.
	 *
	 * @warn This basically just serialises IRScoreData. If a beatoraja update
	 *       causes this to collapse in on itself, that sucks.
	 */
	public IRResponse<Object> sendPlayData(IRChartData model, IRScoreData score) {
		ResponseCreator<Object> rc = new ResponseCreator<Object>();

		PlayData playData = new PlayData(model, score);

		try {
			ObjectWriter ow = new ObjectMapper().writer();
			String json = ow.writeValueAsString(playData);

			TachiResponse resp = POSTRequest("/ir/beatoraja/submit-score", json);

			if (resp.statusCode == 202) {
				log(resp.description, Importance.INFO);
			} else if (resp.statusCode >= 500) {
				log(resp.description, Importance.ERROR);
			} else if (resp.statusCode >= 400) {
				log(resp.description, Importance.WARNING);
			}

			return rc.create(resp.success, resp.description, null);
		} catch (Exception e) {
			System.out.println(e.toString());
			return rc.create(false, "Internal Exception", null);
		}
	}

	private String urlEncode(String value) {
		return URLEncoder.encode(value, StandardCharsets.UTF_8);
	}

	private IRScoreData parseScoreData(JsonNode objNode) {
		ScoreData scoreData = new ScoreData();

		// Yeah, this is just java.
		scoreData.setDate(objNode.path("date").asLong());
		scoreData.setPlayer(objNode.path("player").asText());
		scoreData.setSha256(objNode.path("sha256").asText());
		scoreData.setGauge(objNode.path("gauge").asInt());
		scoreData.setEpg(objNode.path("epg").asInt());
		scoreData.setLpg(objNode.path("lpg").asInt());
		scoreData.setEgr(objNode.path("egr").asInt());
		scoreData.setLgr(objNode.path("lgr").asInt());
		scoreData.setEgd(objNode.path("egd").asInt());
		scoreData.setLgd(objNode.path("lgd").asInt());
		scoreData.setEbd(objNode.path("ebd").asInt());
		scoreData.setLbd(objNode.path("lbd").asInt());
		scoreData.setEpr(objNode.path("epr").asInt());
		scoreData.setLpr(objNode.path("lpr").asInt());
		scoreData.setEms(objNode.path("ems").asInt());
		scoreData.setLms(objNode.path("lms").asInt());
		scoreData.setNotes(objNode.path("notes").asInt());
		scoreData.setPassnotes(objNode.path("passnotes").asInt());
		scoreData.setClear(objNode.path("clear").asInt());
		scoreData.setPlaycount(objNode.path("playcount").asInt());
		scoreData.setRandom(objNode.path("random").asInt());
		scoreData.setMinbp(objNode.path("minbp").asInt());
		scoreData.setCombo(objNode.path("maxcombo").asInt());
		scoreData.setMode(0);

		return new IRScoreData(scoreData);
	}

	private IRScoreData[] parseScores(JsonNode body) {
		ArrayList<IRScoreData> irScoreDatum = new ArrayList<IRScoreData>();

		for (final JsonNode objNode : body) {
			irScoreDatum.add(parseScoreData(objNode));
		}

		// weird java oddities: [0] instantiates a list faster than prealloc
		IRScoreData[] irScoreArr = irScoreDatum.toArray(new IRScoreData[0]);

		// Beatoraja expects these to be sorted.
		Arrays.sort(irScoreArr, (a, b) -> b.getExscore() - a.getExscore());

		return irScoreArr;
	}

	class CourseData {
		public IRCourseData course;
		public IRScoreData score;

		CourseData(IRCourseData crs, IRScoreData scr) {
			score = scr;
			course = crs;
		}
	}

	/**
	 * Sends course play info to the server via submit-course.
	 */
	public IRResponse<Object> sendCoursePlayData(IRCourseData course, IRScoreData score) {
		ResponseCreator<Object> rc = new ResponseCreator<Object>();

		CourseData courseData = new CourseData(course, score);

		try {
			ObjectWriter ow = new ObjectMapper().writer();
			String json = ow.writeValueAsString(courseData);

			TachiResponse resp = POSTRequest("/ir/beatoraja/submit-course", json);

			if (resp.statusCode >= 500) {
				log(resp.description, Importance.ERROR);
			} else if (resp.statusCode >= 400) {
				log(resp.description, Importance.WARNING);
			}

			return rc.create(resp.success, resp.description, null);
		} catch (Exception e) {
			System.out.println(e.toString());
			return rc.create(false, "Internal Exception", null);
		}
	}

	/**
	 * Retrieves other scores on this chart.
	 *
	 * @warn Beatoraja MANDATES that every single record on this chart is returned.
	 *       If Tachi ever blows up to LR2IR scale, this function will obliterate
	 *       both the IR and itself, and aggressive caching will have to be invoked.
	 *       This is a future problem, though.
	 */
	public IRResponse<IRScoreData[]> getPlayData(IRPlayerData irpd, IRChartData model) {
		ResponseCreator<IRScoreData[]> rc = new ResponseCreator<IRScoreData[]>();

		try {
			TachiResponse resp;

			if (model != null) {
				resp = GETRequest("/ir/beatoraja/charts/" + urlEncode(model.sha256) + "/scores");
			} else if (irpd != null) {
				resp = GETRequest("/ir/beatoraja/players/" + urlEncode(irpd.id) + "/scores");
			} else {
				return rc.create(false, "Expected either a player or chart.", new IRScoreData[0]);
			}

			if (!resp.success) {
				return rc.create(false, resp.description, new IRScoreData[0]);
			}

			return rc.create(resp.success, resp.description, parseScores(resp.body));
		} catch (Exception e) {
			String context = model == null ? "player " + (irpd == null ? "<none>" : irpd.name)
					: model.title + " (" + model.sha256 + ")";
			log("An error has occurred while fetching scores for " + context, Importance.ERROR);
			e.printStackTrace(System.out);
			return rc.create(false, "Internal Exception", new IRScoreData[0]);
		}
	}

	public IRResponse<IRPlayerData[]> getRivals() {
		ResponseCreator<IRPlayerData[]> rc = new ResponseCreator<IRPlayerData[]>();

		try {
			TachiResponse resp = GETRequest("/ir/beatoraja/rivals");

			if (!resp.success) {
				return rc.create(false, resp.description, new IRPlayerData[0]);
			}

			ArrayList<IRPlayerData> rivals = new ArrayList<IRPlayerData>();

			for (final JsonNode objNode : resp.body) {
				rivals.add(new IRPlayerData(
						objNode.path("id").asText(),
						objNode.path("name").asText(),
						objNode.path("rank").asText("")));
			}

			return rc.create(true, resp.description, rivals.toArray(new IRPlayerData[0]));
		} catch (Exception e) {
			log("An error has occurred while fetching rivals.", Importance.ERROR);
			e.printStackTrace(System.out);
			return rc.create(false, "Internal Exception", new IRPlayerData[0]);
		}
	}

	public IRResponse<IRTableData[]> getTableDatas() {
		// Not entirely sure what this method is for. No todo here.*
		ResponseCreator<IRTableData[]> rc = new ResponseCreator<IRTableData[]>();
		return rc.create(false, "Unimplemented.", new IRTableData[0]);
	}

	public IRResponse<IRScoreData[]> getCoursePlayData(IRPlayerData irpd, IRCourseData course) {
		// Tachi stores class achievements for courses, not course PB leaderboards.
		ResponseCreator<IRScoreData[]> rc = new ResponseCreator<IRScoreData[]>();
		return rc.create(false, "Course rankings are not supported by Tachi.", new IRScoreData[0]);
	}

	class ChartResolveRequest {
		public String matchType;
		public String identifier;

		ChartResolveRequest(String matchType, String identifier) {
			this.matchType = matchType;
			this.identifier = identifier;
		}
	}

	public String getSongURL(IRChartData chart) {
		String[] games;

		switch (chart.mode) {
			case BEAT_7K:
				games = new String[] { "bms-7k" };
				break;
			case BEAT_14K:
				games = new String[] { "bms-14k" };
				break;
			case POPN_9K:
				games = new String[] { "pms-controller", "pms-keyboard" };
				break;
			default:
				return null;
		}

		for (String game : games) {
			String url = getSongURL(game, chart.sha256);

			if (url != null) {
				return url;
			}
		}

		return null;
	}

	private String getSongURL(String game, String sha256) {
		try {
			ObjectWriter ow = MAPPER.writer();
			String json = ow.writeValueAsString(new ChartResolveRequest("bmsChartHash", sha256));

			TachiResponse resp = POSTRequest("/api/v1/games/" + game + "/charts/resolve", json);

			if (!resp.success) {
				return null;
			}

			String songID = resp.body.get("song").get("id").asText();
			String difficulty = resp.body.get("chart").get("difficulty").asText();

			return BASE_URL + "/games/" + game + "/songs/" + songID + "/" + difficulty;
		} catch (Exception e) {
			log(e.toString(), Importance.ERROR);
		}

		return null;
	}

	public String getCourseURL(IRCourseData course) {
		return null;
	}

	public String getPlayerURL(IRPlayerData irpd) {
		// @warn It's not possible for us to infer what context of
		// playtype this user was referred from. This will have
		// to do.
		return BASE_URL + "/users/" + irpd.name + "/games/bms-7k";
	}
}
