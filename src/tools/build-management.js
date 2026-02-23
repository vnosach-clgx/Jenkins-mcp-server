import {
	encodeJobPath,
	parseScheduleTime,
	isSuccessStatus,
	formatError,
	success,
	failure,
} from "../utils/jenkins.js";
import FormData from "form-data";
import fs from "node:fs";
import path from "node:path";

/**
 * Trigger a build for a Jenkins build
 */
export async function triggerBuild(client, args) {
	const { jobFullName, parameters = {} } = args;
	if (!jobFullName) return failure("triggerBuild", "jobFullName is required");
	const jobPath = encodeJobPath(jobFullName);
	const allowAbsolute = process.env.ALLOW_ABSOLUTE_FILE_PARAMS === "1";

	try {
		const form = new FormData();
		const jsonParams = { parameter: [] };
		let fileIndex = 0;

		for (const [key, value] of Object.entries(parameters)) {
			if (typeof value === "string") {
				const potentialPath = value;
				const isAbsolute = path.isAbsolute(potentialPath);
				const withinCwd =
					!isAbsolute || potentialPath.startsWith(process.cwd());
				const exists =
					withinCwd &&
					fs.existsSync(potentialPath) &&
					fs.statSync(potentialPath).isFile();

				if (exists && (!isAbsolute || allowAbsolute)) {
					const fileFieldName = `file${fileIndex}`;
					form.append(
						fileFieldName,
						fs.createReadStream(potentialPath),
						path.basename(potentialPath)
					);
					jsonParams.parameter.push({
						name: key,
						file: fileFieldName,
					});
					fileIndex++;
					continue;
				} else if (isAbsolute && !allowAbsolute && exists) {
					return failure(
						"triggerBuild",
						`Absolute file paths are not allowed: ${potentialPath}. Set ALLOW_ABSOLUTE_FILE_PARAMS=1 to override.`
					);
				}
			}

			// Regular parameter fallback
			jsonParams.parameter.push({ name: key, value: String(value) });
		}

		form.append("json", JSON.stringify(jsonParams));

		const response = await client.post(
			`${client.baseUrl}/job/${jobPath}/build`,
			form,
			{
				headers: form.getHeaders(),
				maxContentLength: Infinity,
				maxBodyLength: Infinity,
			}
		);

		if (response.status >= 200 && response.status < 300) {
			const location =
				response.headers["location"] || response.headers["Location"];
			const queueId = location?.match(/queue\/item\/(\d+)/)?.[1] || null;
			return success("triggerBuild", {
				message: `Build triggered successfully for ${jobFullName}`,
				queueUrl: location || null,
				queueId,
				statusCode: response.status,
			});
		}
		return failure(
			"triggerBuild",
			`Build trigger returned status ${response.status}`,
			{ statusCode: response.status, data: response.data }
		);
	} catch (error) {
		return formatError(error, "triggerBuild");
	}
}

/**
 * Schedule a Jenkins build to run at a specific time
 */
export async function scheduleBuild(client, args) {
	const { jobFullName, parameters = {}, scheduleTime } = args;
	if (!jobFullName)
		return failure("scheduleBuild", "jobFullName is required");
	if (!scheduleTime)
		return failure("scheduleBuild", "scheduleTime is required");
	const allowAbsolute = process.env.ALLOW_ABSOLUTE_FILE_PARAMS === "1";

	let scheduledDate;
	try {
		scheduledDate = parseScheduleTime(scheduleTime);
	} catch (e) {
		return failure("scheduleBuild", e.message);
	}
	const now = new Date();
	const delayInSeconds = Math.max(
		0,
		Math.floor((scheduledDate - now) / 1000)
	);
	const jobPath = encodeJobPath(jobFullName);

	const form = new FormData();
	for (const [key, value] of Object.entries(parameters)) {
		if (typeof value === "string") {
			const potentialPath = value;
			const isAbsolute = path.isAbsolute(potentialPath);
			const withinCwd =
				!isAbsolute || potentialPath.startsWith(process.cwd());
			const exists =
				withinCwd &&
				fs.existsSync(potentialPath) &&
				fs.statSync(potentialPath).isFile();
			if (exists && (!isAbsolute || allowAbsolute)) {
				form.append(
					key,
					fs.createReadStream(potentialPath),
					path.basename(potentialPath)
				);
				continue;
			} else if (isAbsolute && !allowAbsolute && exists) {
				return failure(
					"scheduleBuild",
					`Absolute file paths are not allowed: ${potentialPath}`
				);
			}
		}
		form.append(key, String(value));
	}

	try {
		const res = await client.post(
			`${client.baseUrl}/job/${jobPath}/buildWithParameters?delay=${delayInSeconds}sec`,
			form,
			{ headers: form.getHeaders(), maxBodyLength: Infinity }
		);
		if (res.status >= 200 && res.status < 300) {
			return success("scheduleBuild", {
				status: res.status,
				queueUrl: res.headers.location,
			});
		}
		return failure(
			"scheduleBuild",
			`Schedule returned status ${res.status}`,
			{ statusCode: res.status }
		);
	} catch (error) {
		return formatError(error, "scheduleBuild");
	}
}

/**
 * Update build display name and/or description
 */
export async function updateBuild(client, args) {
	const {
		jobFullName,
		buildNumber = null,
		displayName = null,
		description = null,
	} = args;
	const jobPath = encodeJobPath(jobFullName);
	const buildPath = buildNumber || "lastBuild";

	try {
		const buildInfo = await client.get(
			`${client.baseUrl}/job/${jobPath}/${buildPath}/api/json?tree=number,url,description`
		);

		if (buildInfo.status !== 200) {
			return failure(
				"updateBuild",
				`Build not found: ${jobFullName}#${buildPath}`,
				{ statusCode: buildInfo.status }
			);
		}

		const actualBuildNumber = buildInfo.data.number;
		const buildUrl = buildInfo.data.url;
		const updates = [];

		// Update description
		if (description !== null && description !== undefined) {
			try {
				const formData = new URLSearchParams();
				formData.append("description", description);

				const response = await client.post(
					`${client.baseUrl}/job/${jobPath}/${actualBuildNumber}/submitDescription`,
					formData.toString(),
					{
						headers: {
							"Content-Type": "application/x-www-form-urlencoded",
						},
					}
				);

				if (isSuccessStatus(response.status)) {
					updates.push({
						field: "description",
						success: true,
						newValue: description,
						statusCode: response.status,
					});
				} else {
					updates.push({
						field: "description",
						success: false,
						error: `Failed with status ${response.status}`,
					});
				}
			} catch (error) {
				updates.push({
					field: "description",
					success: false,
					error: error.message,
				});
			}
		}

		// Display name - not available via REST API
		if (displayName !== null && displayName !== undefined) {
			updates.push({
				field: "displayName",
				success: false,
				error: "Not supported via REST API",
				workaround: "Use Jenkins Script Console with Groovy script",
			});
		}

		return updates.some((u) => u.success)
			? success("updateBuild", {
					buildNumber: actualBuildNumber,
					buildUrl,
					updates,
			  })
			: failure("updateBuild", "No updates applied", {
					buildNumber: actualBuildNumber,
					buildUrl,
					updates,
			  });
	} catch (error) {
		return formatError(error, "updateBuild");
	}
}

/**
 * Stop/kill a running Jenkins build
 */
export async function stopBuild(client, args) {
	const { jobFullName, buildNumber = null } = args;
	const jobPath = encodeJobPath(jobFullName);
	const buildPath = buildNumber || "lastBuild";

	try {
		// Get actual build number and check if build is running
		const buildInfo = await client.get(
			`${client.baseUrl}/job/${jobPath}/${buildPath}/api/json?tree=number,building,result,url`
		);

		if (buildInfo.status !== 200) {
			return failure(
				"stopBuild",
				`Build not found: ${jobFullName}#${buildPath}`,
				{ statusCode: buildInfo.status }
			);
		}

		const actualBuildNumber = buildInfo.data.number;
		const isBuilding = buildInfo.data.building;
		const buildUrl = buildInfo.data.url;

		if (!isBuilding) {
			return failure(
				"stopBuild",
				`Build #${actualBuildNumber} is not currently running`,
				{ buildResult: buildInfo.data.result, buildUrl }
			);
		}

		// Try to stop the build (graceful stop)
		const stopResponse = await client.post(
			`${client.baseUrl}/job/${jobPath}/${actualBuildNumber}/stop`,
			null
		);

		if (isSuccessStatus(stopResponse.status)) {
			return success("stopBuild", {
				message: `Build #${actualBuildNumber} stop request sent successfully`,
				buildNumber: actualBuildNumber,
				buildUrl,
				action: "stop",
			});
		}

		// If stop fails, try kill (forceful termination)
		const killResponse = await client.post(
			`${client.baseUrl}/job/${jobPath}/${actualBuildNumber}/kill`,
			null
		);

		if (isSuccessStatus(killResponse.status)) {
			return success("stopBuild", {
				message: `Build #${actualBuildNumber} kill request sent successfully`,
				buildNumber: actualBuildNumber,
				buildUrl,
				action: "kill",
			});
		}

		return failure(
			"stopBuild",
			`Failed to stop build #${actualBuildNumber}`,
			{ statusCode: stopResponse.status }
		);
	} catch (error) {
		return formatError(error, "stopBuild");
	}
}
