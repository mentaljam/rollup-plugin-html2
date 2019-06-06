import './index.css'

import('./lib').then(mod => {
  (mod && mod.default)()
})
