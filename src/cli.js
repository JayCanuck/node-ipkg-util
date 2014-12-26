/*
	Copyright 2014 Jason Robitaille

	Licensed under the Apache License, Version 2.0 (the "License");
	you may not use this file except in compliance with the License.
	You may obtain a copy of the License at

		http://www.apache.org/licenses/LICENSE-2.0

	Unless required by applicable law or agreed to in writing, software
	distributed under the License is distributed on an "AS IS" BASIS,
	WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
	See the License for the specific language governing permissions and
	limitations under the License.
*/

module.exports = function ipkgCLI() {
	var path = require("path");
	fs = require("fs");

	var VERSION;
	try {
		var pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json")));
		VERSION = pkg.version;
	} catch(e) {
		VERSION = "unknown";
	}

	var args = require("yargs")
			.usage("Usage: ipkg-util [options] <DIR_PATH>")
			.example("ipkg-util --control /path/to/pkg_control /path/to/pkg_data/",
					"\n\tBuilds a .ipk file using a specific control file")
			.example("ipkg-util --feed .",
					"\n\tCreates an ipkg feed for the .ipk files in the current directory")
			.option("p", {
				alias: "prefix",
				type: "string",
				describe: "Destination path prefix for data"
			})
			.option("w", {
				alias: "webos",
				type: "boolean",
				describe: "Use webOS-specific destination prefix"
			})
			.option("c", {
				alias: "control",
				type: "string",
				describe: "Specify filepath for package control"
			})
			.option("preinst", {
				type: "string",
				describe: "Specify filepath for package preinst"
			})
			.option("postinst", {
				type: "string",
				describe: "Specify filepath for package postinst"
			})
			.option("prerm", {
				type: "string",
				describe: "Specify filepath for package prerm"
			})
			.option("postrm", {
				type: "string",
				describe: "Specify filepath for package postrm"
			})
			.option("wpi", {
				alias: "webos-postinst",
				type: "string",
				describe: "Specify filepath for webOS pmPostInstall.script"
			})
			.option("wpr", {
				alias: "webos-prerm",
				type: "string",
				describe: "Specify filepath for webOS pmPreRemove.script"
			})
			.option("o", {
				alias: "output",
				type: "string",
				describe: "Output .ipk file to a desired filepath"
			})
			.option("f", {
				alias: "feed",
				type: "boolean",
				describe: "Enables ipkg feed builder mode for the directory"
			})
			.version(VERSION, "v")
			.alias("v", "version")
			.help("h")
			.alias("h", "help")
			.check(function(parsed, opts) {
				if(parsed && parsed._ && parsed._ && parsed._[0]
						&& fs.existsSync(parsed._[0])) {
					return true;
				}
				throw new Error("Invalid directory path");
			})
			.argv;

	if(args.feed) {
		var feedBuilder = require("./feed.js");
		feedBuilder.build(args._[0], function(err, pkgs, pkgsGz) {
			if(err) {
				console.error("Failed to generate ipkg feed.");
				if(err.message) {
					console.error(err.message);
				}
			} else {
				console.log("Ipkg feed successfully created at " + path.resolve(pkgs));
			}
		});
	} else {
		var ipkgBuilder = require("./builder.js");
		ipkgBuilder.build({
			source: args._[0],
			prefix: args.prefix,
			webos: args.webos,
			control: args.control,
			preinst: args.preinst,
			postinst: args.postinst,
			prerm: args.prerm,
			postrm: args.postrm,
			"webos-postinst": args["webos-postinst"],
			"webos-prerm": args["webos-prerm"],
			output: args.output
		}, function(err, ipk) {
			if(err) {
				console.error("Failed to create ipk file.");
				if(err.message) {
					console.error(err.message);
				}
			} else {
				console.log("Package successfully created at " + path.resolve(ipk));
			}
		});
	}
};
