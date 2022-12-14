const core = require('@actions/core');
const github = require('@actions/github');
const glob = require("glob");
const fs = require('fs');
const readline = require('readline');
var prepositions;
var abbreviations;

var totalFiles = 0;
var ampersandIgnore = ["tips & tricks"];
var errorMULTIQuestions = [];
var errorMULTICapsWords = [];
var errorAmpersand = [];
var errorPrepositionsCapitalized = [];
var errorNoteConsistently = [];

var getDirectories = function (src, callback) {
  glob(src, callback);
};

async function readFile(path) {
  const rl = readline.createInterface({
    input: fs.createReadStream(path),
    output: process.stdout,
    terminal: false
  })

  const line_counter = ((i = 0) => () => ++i)();
  for await (const line of rl) {
    lineno = line_counter();

    //Rule: Use sentence case with numbered or bulleted instruction steps. Only one question per number or bullet.
    if (/^\s*\d[.]/.test(line) || /^\s*-/.test(line)) {

      //Check for multiple question in sentence
      var totalQuestions = line.match(/\?/g);
      if (totalQuestions && totalQuestions.length > 1) {
        var error = "Found multiple questions on a bulleted or numbered step, error on line " + lineno + ", " + path
        errorMULTIQuestions.push(error)
      }

      //Remove abbreviation and phrase
      var abbreviationLineReplace;
      for (let i = 0; i < abbreviations.length; i++) {

        var abbreviation = abbreviations[i];
        var abbreviationRegExp = new RegExp(abbreviation, 'gi');
        if (i > 0) {
          abbreviationLineReplace = abbreviationLineReplace.replace(abbreviationRegExp, "");
        } else {
          abbreviationLineReplace = line.replace(abbreviationRegExp, "");
        }
        abbreviationLineReplace = abbreviationLineReplace.replace(/  /g, ' ');

      }

      //Use sentence case with numbered steps
      var uppercaseWords = abbreviationLineReplace.match(/(\b[A-Z][A-Z]+'S|\b[A-Z][-_A-Z]+|\b [A-Z] \b)/g);//line.match(/(\b[A-Z][-'_A-Z]+|\b[A-Z]\b)/g);
      var lowercaseWords = abbreviationLineReplace.match(/(\b[a-z][a-z]+'s|\b[A-Z][-_a-z]+|\b [a-z] \b)/g); //line.match(/(\b[a-z][-'_a-z]+|\b[a-z]\b)/g);
      if (uppercaseWords && uppercaseWords.length > 1 && lowercaseWords && lowercaseWords.length > 0) {
        var error = "Use sentence case with numbered steps, error on line " + lineno + ", " + path
        errorMULTICapsWords.push(error)
      }
    }

    //Rule: Use "and" instead of "&"
    var ampersandMatch = line.match(/[\w]+\s+&\s+[\w]+/g);
    if (ampersandMatch && ampersandMatch.length > 0) {

      ampersandMatch = ampersandMatch.filter(item => !ampersandIgnore.some(item2 => item2 == item.toLowerCase()));
      if (ampersandMatch.length > 0) {
        var error = 'Use "and" instead of "&", error on line ' + lineno + ', ' + path
        errorAmpersand.push(error);
      }
    }

    // Do not capitalize prepositions, "a" and "an" in headers.
    if (/^\#+\s+./.test(line)) {
      for (var i = 0; i < prepositions.length; i++) {
        var preposition = prepositions[i];
        var prepositionRegExp = new RegExp('\\s+' + preposition + '\\s+', 'i');
        var prepositionRegExpMatch = line.match(prepositionRegExp)
        if (prepositionRegExpMatch != null && prepositionRegExpMatch.length > 0) {
          if (/[A-Z]/.test(prepositionRegExpMatch)) {
            var error = "Prepositions not capitalized in headers, error on line " + lineno + ", " + path
            errorPrepositionsCapitalized.push(error)
            break;
          }
        }
      }
    }

    // Use "Note:" consistently.
    var noteMatch = line.match(/^\s*note.{0,2}|^\*\*note.{0,4}/i);
    if (noteMatch != null && noteMatch.length > 0) {
      if (noteMatch[0].indexOf(":") == -1) {
        var error = '"Note" should be followed by a colon (:), error on line ' + lineno + ', ' + path
        errorNoteConsistently.push(error);
      } else if (noteMatch[0].toLowerCase().indexOf("**note**") == -1) {
        var error = '"Note:" should be boldface, error on line ' + lineno + ', ' + path
        errorNoteConsistently.push(error);
      }
    }
  }

  if (--totalFiles == 0) {
    for (let i = 0; i < errorMULTIQuestions.length; i++) {
      var error = errorMULTIQuestions[i];
      console.log(error)
    }

    for (let i = 0; i < errorMULTICapsWords.length; i++) {
      var error = errorMULTICapsWords[i];
      console.log(error)
    }

    for (let i = 0; i < errorAmpersand.length; i++) {
      var error = errorAmpersand[i];
      console.log(error)
    }

    for (let i = 0; i < errorPrepositionsCapitalized.length; i++) {
      var error = errorPrepositionsCapitalized[i];
      console.log(error)
    }

    for (let i = 0; i < errorNoteConsistently.length; i++) {
      var error = errorNoteConsistently[i];
      console.log(error)
    }
  }
}

try {

  //const globPath = "Test/**/*.md";
  // const globPath = "Test/*.md";
  const globPath = core.getInput('GlobPath');
  const abbreviationFileName = core.getInput('AbbreviationFileName');
  const prepositionsFileName = core.getInput('PrepositionsFileName');

  if (abbreviationFileName) {
    abbreviations = require(`${process.cwd()}/.github/workflows/${abbreviationFileName}.json`)
  } else {
    abbreviations = require('./Abbreviations.json');
  }

  if (prepositionsFileName) {
    prepositions = require(`${process.cwd()}/.github/workflows/${prepositionsFileName}.json`)
  } else {
    prepositions = require('./Prepositions.json');
  }

  getDirectories(globPath, function (err, res) {
    if (err) {
      console.log('Error', err);
    } else {
      //console.log(res);
      if (res.length > 0) {
        for (let index = 0; index < res.length; index++) {
          const path = res[index]
          var stats = fs.statSync(path);
          if (stats.isFile()) {
            ++totalFiles;
            readFile(path);
          }
        }
      }
    }
  });

} catch (error) {
  core.setFailed(error.message);
}