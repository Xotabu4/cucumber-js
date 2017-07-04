import _ from 'lodash'
import ArgvParser from './argv_parser'
import fs from 'mz/fs'
import Gherkin from 'gherkin'
import ProfileLoader from './profile_loader'
import Promise from 'bluebird'
import path from 'path'

export async function getExpandedArgv({ argv, cwd }) {
  let { options } = ArgvParser.parse(argv)
  let fullArgv = argv
  const profileArgv = await new ProfileLoader(cwd).getArgv(options.profile)
  if (profileArgv.length > 0) {
    fullArgv = _.concat(argv.slice(0, 2), profileArgv, argv.slice(2))
  }
  return fullArgv
}

export async function getTestCases({
  cwd,
  eventBroadcaster,
  featurePaths,
  scenarioFilter
}) {
  const result = []
  await Promise.map(featurePaths, async featurePath => {
    const source = await fs.readFile(featurePath, 'utf8')
    const events = Gherkin.generateEvents(
      source,
      path.relative(cwd, featurePath)
    )
    events.forEach(event => {
      eventBroadcaster.emit(event.type, event)
      if (event.type === 'pickle') {
        const { pickle, uri } = event
        if (scenarioFilter.matches({ pickle, uri })) {
          eventBroadcaster.emit('pickle-accepted', { pickle, uri })
          result.push({ pickle, uri })
        } else {
          eventBroadcaster.emit('pickle-rejected', { pickle, uri })
        }
      }
    })
  })
  return result
}
