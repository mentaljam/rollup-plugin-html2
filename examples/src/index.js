import './index.css'

import('./lib').then(function (mod) {
  (mod && mod.default)()
})
