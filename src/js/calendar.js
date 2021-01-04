class VaJSCalendar {
  /** Properties */
  calWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  calDate = moment()
  calYear = this.calDate.year()
  calMonth = this.calDate.month() + 1
  calRenderData = {}
  calStartRenderDate = ''
  calEndRenderDate = ''
  calFilter = {}
  calRequireProcess = 0
  calConfig = {
    minLoadingTime: 300,
    stackStartNum: 4 - 1,
  }

  /**
   * Constructor
   * @param elm                         Select target for rendering calendar.
   * @param options                     Options.
   */
  constructor (elm = null, options = {}) {
    this.initialize(elm, options)
  }

  /**
   * Initialize
   * @param elm
   * @param options
   */
  initialize = (elm, options) => {
    // Change options with initialize
    const calOptions = Object.assign({
      year: this.calYear,
      month: this.calMonth,
      minLoadingTime: this.calConfig.minLoadingTime
    }, options)
    this.calYear = calOptions.year
    this.calMonth = calOptions.month
    this.calConfig.minLoadingTime = calOptions.minLoadingTime

    // Initial rendering target
    const target = elm || document.querySelector('#calendar-wrap')

    // Initial rendering
    target.innerHTML = `
      <div>
        <div class="calendar-top">
          <button id="prev-calendar" type="button"></button>
          <h1 id="calendar-term"></h1>
          <button id="next-calendar" type="button"></button>
        </div>
      </div>
      <div id="calendar"></div>
      <div id="calendar-load-wrap"><div class="load"></div></div>
      `

    // Add event listener
    document.querySelector('#prev-calendar').addEventListener('click', this.renderPrevMonthCalendar)
    document.querySelector('#next-calendar').addEventListener('click', this.renderNextMonthCalendar)
    document.addEventListener('click', this.initializeEvent)
    window.onresize = this.adjustCalendarWidth
  }

  /**
   * Initial event
   * @param e                           Event from click.
   * @returns {boolean}                 Return boolean.
   */
  initializeEvent = async (e) => {
    // If click date area
    const dateAreaClassList = ['calendar_td', 'is-disabled', 'day']
    if (dateAreaClassList.some((className) => this.hasClass(e, className))) {
      const res = await this.isEditableSchedule()
      if (res.data) {
        const dataElm = e.target.closest('td[data-date]')
        this.renderScheduleFormPost({ date: dataElm.dataset.date })
      }
      return true
    }

    // If click schedule
    const scheduleClassList = ['schedule-tag', 'schedule-text', 'schedule-time', 'schedule-title']
    if (scheduleClassList.some((className) => this.hasClass(e, className))) {
      const dataElm = e.target.closest('.schedule-tag').firstElementChild
      await this.renderScheduleDetail(dataElm.dataset.schedule_id)
      return true
    }

    // If click modal back
    if (e.target.id === 'app-modal-back') {
      this.deleteModal()
      return true
    }

    // If click stack schedule
    if (this.hasClass(e, 'schedule-other')) {
      await this.renderStackSchedule(e.target.dataset.stack_date)
      return true
    }

    return true
  }

  /**
   * Generate html for calendar base layer
   * @param year                        Year for a calendar.
   * @param month                       Month for a calendar.
   * @returns {string}                  Generated html.
   */
  generateCalendarBaseLayer = (year, month) => {
    const startDate = moment(`${year}-${('0' + month).slice(-2)}-01`)
    const endDate = moment(`${year}-${('0' + month).slice(-2)}-01`).endOf('month')
    const endDateCount = endDate.date()
    const prevMonthEndDate = moment(`${year}-${('0' + month).slice(-2)}-01`).subtract(1, 'months').endOf('month')
    const prevMonthEndDayCount = prevMonthEndDate.date()
    const nextMonthStartDate = moment(`${year}-${('0' + month).slice(-2)}-01`).add(1, 'months').startOf('month')
    const startDay = startDate.day()
    let dateCount = 1

    // Display year/month
    document.querySelector('#calendar-term').textContent = `${year}/${month}`

    // Initialize schedule data map
    this.calRenderData = {}

    // Calendar outer html
    const calendar = document.createElement('table')
    calendar.id = 'calendar-base'

    // Generate inner html
    let html = ''

    // Day of week row
    html += '<tr>'
    for (let i = 0; i < this.calWeek.length; i++) {
      html += `<td>${this.calWeek[i]}</td>`
    }
    html += '</tr>'

    // Date row
    for (let w = 0; w < 6; w++) {
      html += '<tr>'
      for (let d = 0; d < 7; d++) {
        if (w === 0 && d < startDay) {
          // Prev month date count
          let num = prevMonthEndDayCount - startDay + d + 1
          let date = `${prevMonthEndDate.year()}-${('0' + (prevMonthEndDate.month() + 1)).slice(-2)}-${('0' + num).slice(-2)}`
          this.calRenderData[date] = []
          html += `<td class="is-disabled" data-date="${date}"><div class="day">${num}</div></td>`
        } else if (dateCount > endDateCount) {
          // Next month date count
          let num = dateCount - endDateCount
          let date = `${nextMonthStartDate.year()}-${('0' + (nextMonthStartDate.month() + 1)).slice(-2)}-${('0' + num).slice(-2)}`
          this.calRenderData[date] = []
          html += `<td class="is-disabled" data-date="${date}"><div class="day">${num}</div></td>`
          dateCount++
        } else {
          // Main month date count
          let date = `${year}-${('0' + month).slice(-2)}-${('0' + dateCount).slice(-2)}`
          this.calRenderData[date] = []
          html += `<td class="calendar_td" data-date="${date}"><div class="day">${dateCount}</div></td>`
          dateCount++
        }
      }
      html += '</tr>'
    }
    calendar.innerHTML = html

    // Update date range
    this.calStartRenderDate = Object.keys(this.calRenderData).shift()
    const tmpDate = moment(Object.keys(this.calRenderData).pop())
    tmpDate.set('date', (tmpDate.date() + 1))
    this.calEndRenderDate = this.parseDateToDate(tmpDate)

    // Return generated html
    // console.log('Generate calendar done.')
    return calendar.outerHTML
  }

  /**
   * Render Calendar
   * @param filter                      Filter for filtering schedule.
   * @returns {Promise<boolean>}        Return promise or boolean.
   */
  renderCalendar = async (filter = {}) => {
    try {
      const calendar = document.querySelector('#calendar')
      if (calendar) {
        // Process
        this.calRequireProcess++
        const currentProcess = this.calRequireProcess
        this.checkReRender(currentProcess)

        // Initialize inner html
        document.querySelector('#calendar').innerHTML = ''
        this.checkReRender(currentProcess)

        // Render calendar base layer
        calendar.innerHTML = this.generateCalendarBaseLayer(this.calYear, this.calMonth)
        this.checkReRender(currentProcess)
        // console.log('Render base calendar done.')

        // Display loading
        const startTime = performance.now()
        const loader = document.querySelector('#calendar-load-wrap')
        if (loader) {
          loader.style.height = `${document.querySelector('#calendar-base').offsetHeight}px`
          loader.style.display = `flex`
          // console.log('Render loading status.')
        }
        this.checkReRender(currentProcess)

        // Render schedule base layer
        this.renderCalendarScheduleLayer()
        this.checkReRender(currentProcess)

        // Resizing calendar width (first time)
        await this.adjustCalendarWidth()
        this.checkReRender(currentProcess)

        // Get schedule and render schedule base layer and schedule
        if (filter) {
          this.calFilter = filter
        }
        await this.getSchedule(this.calYear, this.calMonth, this.calFilter)
          .then((res) => {
            if (Array.isArray(res.data)) {
              res.data.forEach((obj) => {
                this.renderSchedule(obj)
                this.checkReRender(currentProcess)
              })
            }
          }).then(() => {
            Object.keys(this.calRenderData).forEach((key) => {
              const num = this.calRenderData[key].length - this.calConfig.stackStartNum - 1
              if (num > 0) {
                const dateElm = document.querySelector(`[data-date="${key}"]`)
                const scheduleRowElm = document.querySelector(`[data-schedule_rows="${(dateElm.parentElement.rowIndex * 2)}"]`)
                const other = document.createElement('div')

                other.style.width = `calc(100% / 7 * 1 - 0.5em)`
                other.style.position = `absolute`
                other.style.left = `calc(100% / 7 * ${dateElm.cellIndex} + 0.2em)`
                other.style.zIndex = `95`
                other.textContent = `other:${num}`
                other.classList.add('schedule-other')
                other.dataset.stack_date = `${key}`
                scheduleRowElm.appendChild(other)
                other.style.top = `${((other.offsetHeight * (this.calConfig.stackStartNum + 1)) + 2 * (this.calConfig.stackStartNum + 3))}px`
              }
              this.checkReRender(currentProcess)
            })
          }).then(() => {
            if (loader) {
              const execTime = performance.now() - startTime
              const waitTime = (execTime > this.calConfig.minLoadingTime || execTime < 0)
                ? 0
                : (this.calConfig.minLoadingTime - execTime)

              setTimeout(() => loader.style.display = `none`, waitTime)
              // console.log('Remove loading status.')
            }
          }).then(() => {
            this.adjustCalendarWidth()
          })

        // console.log('Render all schedule done.')
        // console.log('Render all calendar system done.')
      }
      return true
    } catch (e) {
      // console.log('debug error occurred')
      return false
    }
  }

  /**
   * Render prev month calendar
   */
  renderPrevMonthCalendar = async () => {
    this.calMonth--
    if (this.calMonth < 1) {
      this.calYear--
      this.calMonth = 12
    }
    await this.renderCalendar(this.calFilter)
    return true
  }

  /**
   * Render next month calendar
   */
  renderNextMonthCalendar = async () => {
    this.calMonth++
    if (this.calMonth > 12) {
      this.calYear++
      this.calMonth = 1
    }
    await this.renderCalendar(this.calFilter)
    return true
  }

  /**
   * Render schedule base layer
   */
  renderCalendarScheduleLayer = () => {
    const calendarBaseElm = document.querySelector('#calendar-base')
    const dateRowCount = calendarBaseElm.rows.length - 1
    const top = calendarBaseElm.offsetTop
    const width = calendarBaseElm.offsetWidth
    const dayOfWeekRowHeight = calendarBaseElm.rows[0].offsetHeight
    const dateHeight = calendarBaseElm.rows[1].firstElementChild.firstElementChild.offsetHeight
    const scheduleHeight = calendarBaseElm.rows[1].firstElementChild.offsetHeight - dateHeight

    // Select or create schedule base layer
    let calendarSchedule = document.querySelector('#calendar-schedule')
    if (!calendarSchedule) {
      calendarSchedule = document.createElement('div')
      calendarSchedule.id = 'calendar-schedule'
      calendarBaseElm.parentNode.insertBefore(calendarSchedule, calendarBaseElm.nextSibling)
      // console.log('gen schedule layer')
    }
    calendarSchedule.style.top = `${top}px`
    calendarSchedule.style.width = `${width}px`

    // Generate html for schedule base layer
    calendarSchedule.innerHTML = ''
    for (let i = 0; i < ((dateRowCount * 2) + 1); i++) {
      calendarSchedule.innerHTML += `<div class="schedule-line" data-schedule_rows="${i}"></div>`
      const scheduleLine = document.querySelector(`[data-schedule_rows="${i}"]`)
      if (i === 0) {
        scheduleLine.style.height = `${dayOfWeekRowHeight}px`
      } else if (i % 2 === 0) {
        scheduleLine.style.height = `${scheduleHeight}px`
      } else {
        scheduleLine.style.height = `${dateHeight}px`
      }
      scheduleLine.style.width = '100%'
      scheduleLine.style.position = 'relative'
    }
  }

  /**
   * Render schedule
   * @param datum                       Datum for render schedule.
   * @returns {boolean}                 Return boolean.
   */
  renderSchedule = (datum) => {
    // Return true when schedules cannot be rendered on a calendar
    if (((moment(datum.end) < (moment(`${this.calStartRenderDate} 12:00:00`))) && (moment(datum.start) < (moment(`${this.calStartRenderDate} 00:00:00`))))
      || (moment(datum.start) >= (moment(`${this.calEndRenderDate} 00:00:00`)))) {
      return true
    }

    // Date settings
    const startDateTime = (moment(datum.start) > moment(`${this.calStartRenderDate} 00:00:00`))
      ? moment(datum.start)
      : moment(`${this.calStartRenderDate} 00:00:00`)
    const startDate = this.parseDateToDate(startDateTime)
    const startTime = this.parseDateToTime(startDateTime)
    const endDateTime = (moment(datum.end) < moment(`${this.calEndRenderDate} 00:00:00`))
      ? moment(datum.end)
      : moment(`${this.calEndRenderDate} 00:00:00`)
    const dateDiff = Math.floor((endDateTime - startDateTime) / (60 * 60 * 24 * 1000))
    const scheduleUsingCell = Math.max(1, dateDiff + ((dateDiff >= 1 && endDateTime.hour() >= 12) ? 1 : 0))

    // Drawing all day flag of schedule tag
    const isNotAllDay = (dateDiff < 1) || ((dateDiff === 1) && endDateTime.hour() > 0 && endDateTime.hour < 12)

    // Rendering core settings
    let startDateTimeTmp = moment(datum.start)
    let remainingRenderCell = scheduleUsingCell
    let currentRow = 0
    let currentColumn = startDateTime.day()
    let renderColumnNum
    let maxStackScheduleNum = 0
    let parallelHeight = 0
    let loopNum = 1

    // Rendering core
    while (remainingRenderCell > 0) {
      renderColumnNum = ((currentColumn + remainingRenderCell) > 7)
        ? (7 - currentColumn)
        : remainingRenderCell

      // Schedule div
      const scheduleTag = document.createElement('div')
      const textArea = document.createElement('span')
      const time = document.createElement('span')
      const title = document.createElement('span')

      // Schedule div design
      if (!isNotAllDay) { // All day
        scheduleTag.className = `schedule-tag schedule-tag-day`
        if ((endDateTime - startDateTime) % (60 * 60 * 24 * 1000) === 0) {
          title.textContent = datum.title
        } else {
          time.textContent = (loopNum === 1) ? `${startTime} ` : ``
          title.textContent = datum.title
        }
        textArea.className = 'schedule-text schedule-text-day'

      } else {  // Not all day
        scheduleTag.className = `schedule-tag schedule-tag-time`
        time.textContent = `${startTime} `
        title.textContent = datum.title
        textArea.className = 'schedule-text schedule-text-time'
      }
      time.className = `schedule-time`
      title.className = `schedule-title`
      textArea.appendChild(time)
      textArea.appendChild(title)

      // Dataset
      const scheduleData = document.createElement('div')
      scheduleData.classList.add('dataset')
      scheduleData.dataset.schedule_id = datum.id

      // Select rendering target
      const selector = document.querySelector(`[data-date="${startDate}"]`)
      if (selector) {
        if (currentRow === 0) {
          currentRow = selector.parentElement.sectionRowIndex
        }

        // Build html for schedule tag
        scheduleTag.appendChild(scheduleData)
        scheduleTag.appendChild(textArea)

        // Get max stack schedule number from date range of rendering schedule
        for (let i = startDateTime.date(); i < startDateTime.date() + scheduleUsingCell; i++) {
          startDateTimeTmp = moment(datum.start)
          startDateTimeTmp.set('date', i)
          const date = this.parseDateToDate(startDateTimeTmp)
          if (this.calRenderData[date]) {
            maxStackScheduleNum = Math.max(maxStackScheduleNum, this.calRenderData[date].length)
          }
        }

        // Get position that schedules can be rendered
        loop:
          for (let i = startDateTime.date(); i < startDateTime.date() + scheduleUsingCell; i++) {
            startDateTimeTmp = moment(datum.start)
            startDateTimeTmp.set('date', i)
            const date = this.parseDateToDate(startDateTimeTmp)
            if (this.calRenderData[date]) {
              for (let j = 0; j < maxStackScheduleNum + 1; j++) {
                if (this.calRenderData[date][j] !== 1 && parallelHeight === j) {
                  continue loop
                } else if (this.calRenderData[date][j] !== 1) {
                  parallelHeight = Math.max(parallelHeight, j)
                  continue loop
                }
              }
            }
          }

        // If need stacking schedule
        if (parallelHeight > this.calConfig.stackStartNum) {
          renderColumnNum = 1

        } else {
          // Schedule tag styles
          scheduleTag.style.width = `calc(100% / 7 * ${renderColumnNum} - 0.5em)`
          scheduleTag.style.position = 'absolute'
          scheduleTag.style.left = `calc(100% / 7 * ${currentColumn} + 0.2em)`

          // Render schedule
          document.querySelector(`[data-schedule_rows="${(currentRow * 2)}"]`).appendChild(scheduleTag)

          // Schedule tag styles
          scheduleTag.style.top = `${((scheduleTag.offsetHeight * parallelHeight) + (2 * (parallelHeight + 1)))}px`
          scheduleTag.style.zIndex = `95`
        }

        // Update rendering core settings
        remainingRenderCell -= renderColumnNum
        if (currentColumn + renderColumnNum > 6) {
          currentColumn = 0
          currentRow++
        } else {
          currentColumn += renderColumnNum
        }
        loopNum++
      }
    }

    // Update renderData
    for (let i = startDateTime.date(); i < startDateTime.date() + scheduleUsingCell; i++) {
      startDateTimeTmp = moment(datum.start)
      startDateTimeTmp.set('date', i)
      const date = this.parseDateToDate(startDateTimeTmp)
      if (this.calRenderData[date]) {
        if (this.calRenderData[date].length < maxStackScheduleNum) {
          for (let j = 0; j < maxStackScheduleNum + 1; j++) {
            if (!this.calRenderData[date][j]) {
              this.calRenderData[date][j] = 0
            }
          }
        }
        this.calRenderData[date][parallelHeight] = 1
      }
    }
    // console.log('Render schedule done.')
  }

  /**
   * Render schedule detail
   * @param id                          Schedule id for details.
   * @returns {Promise<void>}           Return promise or boolean.
   */
  renderScheduleDetail = async (id) => {
    // Reset modal display
    this.deleteModal()

    // Modal back
    const appModalBack = document.createElement('div')
    appModalBack.id = 'app-modal-back'

    // Modal area
    const appModalArea = document.createElement('div')
    appModalArea.id = 'app-modal-area'

    // Modal controller
    const scheduleModalController = document.createElement('div')
    scheduleModalController.id = 'schedule-modal-controller'

    // Btn delete modal
    const scheduleModalDel = document.createElement('button')
    scheduleModalDel.id = 'schedule-modal-del'

    // Modal body
    const scheduleModalBody = document.createElement('div')
    scheduleModalBody.id = 'schedule-modal-body'

    // Display loading
    const loadModal = await this.createLoadingDisplay()
    const startTime = performance.now()

    // Get schedule detail and parse
    const detail = (await this.getScheduleDetail(id)).data
    if (detail) {
      // Btn edit schedule
      const scheduleStartEdit = document.createElement('button')
      scheduleStartEdit.id = 'schedule-start-edit'
      scheduleStartEdit.textContent = 'Edit'

      // Btn delete schedule
      const scheduleDel = document.createElement('button')
      scheduleDel.id = 'schedule-del'
      scheduleDel.textContent = 'Delete'

      // Schedule title
      const scheduleTitle = document.createElement('h2')
      scheduleTitle.textContent = detail.title

      // Schedule description
      const scheduleDesc = document.createElement('div')
      scheduleDesc.classList.add('schedule-modal-desc')
      scheduleDesc.textContent = detail.description

      // Schedule time
      const scheduleTimeArea = document.createElement('div')
      scheduleTimeArea.classList.add('date-wrap')

      const scheduleTimeTtl = document.createElement('span')
      scheduleTimeTtl.classList.add('date-ttl')
      scheduleTimeTtl.textContent = 'DateTime'

      const scheduleTime = document.createElement('span')
      scheduleTime.classList.add('date')

      const startDateTime = moment(detail.start)
      const endDateTime = moment(detail.end)

      if (this.parseDateToTime(startDateTime) === '00:00' && this.parseDateToTime(endDateTime) === '00:00') {
        endDateTime.set('date', (endDateTime.date() - 1))
        scheduleTime.textContent = (this.parseDateToDate(startDateTime) === this.parseDateToDate(endDateTime))
          ? `${this.parseDateToDate(startDateTime)}`
          : `${this.parseDateToDate(startDateTime)} ~ ${this.parseDateToDate(endDateTime)}`
      } else {
        scheduleTime.textContent = (this.parseDateToDate(startDateTime) === this.parseDateToDate(endDateTime))
          ? `${this.parseDateToDate(startDateTime)} ${this.parseDateToTime(startDateTime)} ~ ${this.parseDateToTime(endDateTime)}`
          : `${this.parseDateToDate(startDateTime)} ${this.parseDateToTime(startDateTime)} ~ ${this.parseDateToDate(endDateTime)} ${this.parseDateToTime(endDateTime)}`
      }

      // Build html
      appModalBack.appendChild(appModalArea)
      appModalArea.appendChild(scheduleModalController)
      if (detail.editable) {
        scheduleModalController.appendChild(scheduleStartEdit)
        scheduleModalController.appendChild(scheduleDel)
      }
      scheduleModalController.appendChild(scheduleModalDel)
      appModalArea.appendChild(scheduleModalBody)

      scheduleTimeArea.appendChild(scheduleTimeTtl)
      scheduleTimeArea.appendChild(scheduleTime)

      //セミナー名
      scheduleModalBody.appendChild(scheduleTitle)

      //備考
      if (detail.description) {
        scheduleModalBody.appendChild(scheduleDesc)
      }

      //datetime
      scheduleModalBody.appendChild(scheduleTimeArea)

      // Render
      document.querySelector('body').appendChild(appModalBack)

      // Add event listener
      document.querySelector('#schedule-modal-del').addEventListener('click', this.deleteModal)
      if (detail.editable) {
        document.querySelector('#schedule-start-edit')
          .addEventListener('click', () => this.renderScheduleFormPut(detail))
        document.querySelector('#schedule-del')
          .addEventListener('click', () => this.deleteSchedule(detail.id))
      }
    }

    // Remove loading display
    const execTime = performance.now() - startTime
    const waitTime = (execTime > this.calConfig.minLoadingTime || execTime < 0)
      ? 0
      : this.calConfig.minLoadingTime - execTime
    setTimeout(() => this.deleteLoadingDisplay(loadModal), waitTime)
  }

  /**
   * Render form for creating schedule
   */
  renderScheduleFormPost = (data) => {
    // Reset modal display
    this.deleteModal()

    // Modal back
    const appModalBack = document.createElement('div')
    appModalBack.id = 'app-modal-back'

    // Modal area
    const appModalArea = document.createElement('div')
    appModalArea.id = 'app-modal-area'
    appModalArea.innerHTML = `
      <div id="schedule-modal-controller">
        <button id="schedule-modal-del"></button>
      </div>
      <div id="schedule-modal-body"></div>`

    // Build html
    appModalBack.appendChild(appModalArea)

    // Build html for timetable option
    let optionHtml = ''
    for (let i = 0; i < 24; i++) {
      for (let j = 0; j < 2; j++) {
        let time = `${('0' + i).slice(-2)}:${('0' + (30 * j)).slice(-2)}`
        optionHtml += `<option value="${time}">${time}</option>`
      }
    }

    // Build html
    const scheduleModalBody = appModalBack.querySelector('#schedule-modal-body')
    scheduleModalBody.innerHTML = `
      <form action="" method="post" id="post-schedule" name="form">
        <div class="edit-date-time">
          <label class="edit-date">
            <input type="date" name="st_date" value="${data.date}">
          </label>
          <label class="edit-time">
            <select name="st_time">${optionHtml}</select>
          </label>
          <span>～</span>
          <label class="edit-date">
            <input type="date" name="end_date" value="${data.date}">
          </label>
          <label class="edit-time">
            <select name="end_time">${optionHtml}</select>
          </label>
        </div>
        <div class="edit-ttl">
          <label>
            <input type="text" name="title" placeholder="Title">
          </label>
        </div>
        <div class="edit-desc">
          <label>
            <textarea name="description" placeholder="Description"></textarea>
          </label>
        </div>
        <div class="edit-submit">
          <input type="submit" value="ADD" class="edit-submit-btn">
        </div>
      </form>`
    document.querySelector('body').appendChild(appModalBack)

    // Add event listener
    document.querySelector('#schedule-modal-del').addEventListener('click', this.deleteModal)
    document.querySelector('#post-schedule').addEventListener('submit', this.postSchedule)
  }

  /**
   * Render form for editing schedule
   * @param data                        Schedule datum.
   */
  renderScheduleFormPut = (data = {}) => {
    // Reset form area
    const elm = document.querySelector('#edit-schedule')
    if (elm) {
      elm.parentNode.removeChild(elm)
    }

    // Remove btn edit
    const editStartBtn = document.querySelector('#schedule-start-edit')
    if (editStartBtn) {
      editStartBtn.parentNode.removeChild(editStartBtn)
    }

    // Date settings
    const startDateTime = moment(data.start)
    const endDateTime = moment(data.end)
    const startTime = this.parseDateToTime(startDateTime)
    const endTime = this.parseDateToTime(endDateTime)

    // Build html for timetable options
    let startTimeHtml = ''
    let endTimeHtml = ''
    for (let i = 0; i < 24; i++) {
      for (let j = 0; j < 2; j++) {
        const time = `${('0' + i).slice(-2)}:${('0' + (30 * j)).slice(-2)}`
        startTimeHtml += `<option value="${time}" ${(startTime === time) ? 'selected' : ''}>${time}</option>`
        endTimeHtml += `<option value="${time}" ${(endTime === time) ? 'selected' : ''}>${time}</option>`
      }
    }

    // Build html for edit schedule form and Render
    document.querySelector('#schedule-modal-body').innerHTML = `
        <form action="" method="post" id="edit-schedule" name="form">
          <div class="edit-date-time">
            <label class="edit-date">
              <input type="date" name="st_date" value="${this.parseDateToDate(startDateTime)}">
            </label>
            <label class="edit-time">
              <select name="st_time">${startTimeHtml}</select>
            </label>
            <span>～</span>
            <label class="edit-date">
              <input type="date" name="end_date" value="${this.parseDateToDate(endDateTime)}">
            </label>
            <label class="edit-time">
              <select name="end_time">${endTimeHtml}</select>
            </label>
          </div>
          <div class="edit-ttl">
            <label>
              <input type="text" name="title" value="${data.title}" placeholder="Title">
            </label>
          </div>
          <div class="edit-desc">
            <label>
              <textarea name="description" placeholder="Description">${data.description}</textarea>
            </label>
          </div>
          <div class="edit-submit">
            <input type="hidden" name="schedule_id" value="${data.id}">
            <input type="submit" value="Update" class="edit-submit-btn">
          </div>
        </form>`

    // Add event listener
    document.querySelector('#edit-schedule').addEventListener('submit', this.putSchedule)
  }

  /**
   * Render stack (other) schedules of target date
   * @param date                        Date for get target schedules.
   */
  renderStackSchedule = async (date) => {
    // Date setting
    const requireDate = moment(date)

    // Display loading
    const loadModal = await this.createLoadingDisplay()
    const startTime = performance.now()

    // Modal back
    const appModalBack = document.createElement('div')
    appModalBack.id = 'app-modal-back'

    // Modal area
    const appModalArea = document.createElement('div')
    appModalArea.id = 'app-modal-area'

    // Date area
    const dateArea = document.createElement('div')
    dateArea.id = `schedule-modal-date`
    dateArea.innerText = `${this.parseDateToDate(requireDate)}(${this.calWeek[requireDate.day()]})`

    // Build html
    appModalBack.appendChild(appModalArea)
    appModalArea.appendChild(dateArea)

    // Get schedule detail
    const formParam = new URLSearchParams()
    formParam.append('date', date)
    formParam.append('csrf_token', this.getCsrfToken())

    const res = await fetch('sample_data/stackSchedule.json', {
      method: 'post',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: formParam
    })

    if (!res.ok) {
      throw new Error('Undefined error occurred')
    }

    // Response
    const obj = await res.json()

    // Render modal back
    document.querySelector('#calendar-wrap').appendChild(appModalBack)

    // Render schedule tag
    for (const datum of obj.data) {
      // Date settings
      const startDateTime = ((moment(datum.start)) > (moment(`${this.calStartRenderDate} 00:00:00`)))
        ? (moment(datum.start))
        : (moment(`${this.calStartRenderDate} 00:00:00`))
      const startTime = `${('0' + (startDateTime.hour())).slice(-2)}:${('0' + startDateTime.minute()).slice(-2)}`
      const endDateTime = ((moment(datum.end)) < (moment(`${this.calEndRenderDate} 00:00:00`)))
        ? (moment(datum.end))
        : (moment(`${this.calEndRenderDate} 00:00:00`))
      const dateDiff = Math.floor((endDateTime - startDateTime) / (60 * 60 * 24 * 1000))

      // Flag of all day
      const isNotAllDay = (dateDiff < 1) || ((dateDiff === 1) && endDateTime.hour() > 0 && endDateTime.hour() < 12)

      // Schedule tag
      const scheduleTag = document.createElement('div')
      const textArea = document.createElement('span')
      const time = document.createElement('span')
      const title = document.createElement('span')

      // Schedule tag styles
      if (!isNotAllDay) { // All day
        scheduleTag.className = `schedule-tag schedule-tag-day`
        time.textContent = ((endDateTime - startDateTime) % (60 * 60 * 24 * 1000) === 0)
          ? ``
          : `${startTime} `
        title.textContent = datum.title
        textArea.className = 'schedule-text schedule-text-day'

      } else {  // Not all day
        scheduleTag.className = `schedule-tag schedule-tag-time`
        time.textContent = `${startTime} `
        title.textContent = datum.title
        textArea.className = 'schedule-text schedule-text-time'
      }
      time.className = `schedule-time`
      title.className = `schedule-title`
      textArea.appendChild(time)
      textArea.appendChild(title)

      // Schedule data
      const scheduleData = document.createElement('div')
      scheduleData.classList.add('dataset')
      scheduleData.dataset.schedule_id = datum.id

      // Build html
      scheduleTag.appendChild(scheduleData)
      scheduleTag.appendChild(textArea)

      // Render schedule tag
      appModalArea.appendChild(scheduleTag)
    }

    // Remove loading display
    const execTime = performance.now() - startTime
    const waitTime = (execTime > this.calConfig.minLoadingTime || execTime < 0)
      ? 0
      : this.calConfig.minLoadingTime - execTime
    setTimeout(() => this.deleteLoadingDisplay(loadModal), waitTime)

    return true
  }

  /**
   * Resizing calendar width
   * @returns {Promise<boolean>}        Return promise or boolean.
   */
  adjustCalendarWidth = async () => {
    const currentCalendarWidth = document.querySelector('#calendar').offsetWidth
    const dateWidth = (currentCalendarWidth / 7)
    document.querySelectorAll('#calendar-base td')
      .forEach((elm) => elm.style.width = `${dateWidth}px`)

    // Schedule base layer
    document.querySelector('#calendar-schedule').style.width = `${currentCalendarWidth}px`
    // console.log(currentCalendarWidth)

    // Calendar Height
    const currentCalendarBaseHeight = document.querySelector('#calendar-base').offsetHeight
    document.querySelector('#calendar').style.height = `${currentCalendarBaseHeight}px`

    // console.log('Adjust calendar done.')
    return true
  }

  /**
   * Get schedule data from database
   * @param year                        Full year for get schedule.
   * @param month                       Month for get schedule.
   * @param options                     Options for filtering schedule.
   * @returns {Promise<any|boolean>}    Return promise or boolean.
   */
  getSchedule = async (year, month, options) => {
    // Build post query
    const formParam = new URLSearchParams()
    formParam.append('year', year)
    formParam.append('month', month)
    formParam.append('options', JSON.stringify(options))
    formParam.append('csrf_token', this.getCsrfToken())

    // Get schedule data
    const res = await fetch('sample_data/schedule.json', {
      method: 'post',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: formParam
    })

    if (!res.ok) {
      throw new Error('Undefined error occurred')
    }

    return res.json()
  }

  /**
   * Get a schedule detail from database
   * @param id                          Schedule id.
   * @returns {Promise<any|boolean>}    Return promise or boolean.
   */
  getScheduleDetail = async (id) => {
    // Build post query
    const formParam = new URLSearchParams()
    formParam.append('schedule_id', id)
    formParam.append('csrf_token', this.getCsrfToken())

    // Send post query
    const res = await fetch('sample_data/detail.json', {
      method: 'post',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: formParam
    })

    // Response
    if (!res.ok) {
      throw new Error('Undefined error occurred')
    }

    return res.json()
  }

  /**
   * Validate is editable schedule
   * @return {Promise<any>}
   */
  isEditableSchedule = async () => {
    const formParam = new URLSearchParams()
    formParam.append('csrf_token', this.getCsrfToken())

    const res = await fetch('sample_data/isEditable.json', {
      method: 'post',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: formParam
    })

    if (!res.ok) {
      throw new Error('Undefined error occurred')
    }

    return res.json()
  }

  /**
   * Create schedule
   * @param e                           Event from form submit.
   */
  postSchedule = async (e) => {
    e.preventDefault()

    // Build post query
    const formParam = this.genFormParam(e, 'post')

    // Send post query
    const res = await fetch('post', {
      method: 'post',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: formParam
    })

    // Response
    if (!res.ok) {
      throw new Error('Undefined error occurred')
    }

    this.deleteModal()
    await this.renderCalendar(this.calFilter)
  }

  /**
   * Put schedule
   * @param e                           Event from form submit.
   */
  putSchedule = async (e) => {
    e.preventDefault()

    // Build post query
    const formParam = this.genFormParam(e, 'put')

    // Send put query
    const res = await fetch('put', {
      method: 'put',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: formParam
    })

    // Response
    if (!res.ok) {
      throw new Error('Undefined error occurred')
    }

    this.deleteModal()
    await this.renderCalendar(this.calFilter)
  }

  /**
   * Delete schedule
   * @param id                          Schedule id.
   */
  deleteSchedule = async (id) => {
    // Confirm check
    if (window.confirm('Delete this schedule？')) {
      // Build post query
      const formParam = new URLSearchParams()
      formParam.append('schedule_id', id)
      formParam.append('csrf_token', this.getCsrfToken())

      // Send delete query
      const res = await fetch('delete', {
        method: 'delete',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: formParam
      })

      // Response
      if (!res.ok) {
        throw new Error('Undefined error occurred')
      }

      this.deleteModal()
      await this.renderCalendar(this.calFilter)
    }
  }

  /**
   * Generate form param
   * @param e                           Event from form submit.
   * @param method                      Method('post' | 'put') string.
   * @return {URLSearchParams}          Generated form param.
   */
  genFormParam = (e, method) => {
    const formParam = new URLSearchParams()

    formParam.append('st_date', e.target.st_date.value)
    formParam.append('st_time', e.target.st_time.value)
    formParam.append('end_date', e.target.st_date.value)
    formParam.append('end_time', e.target.end_time.value)
    formParam.append('title', e.target.title.value)
    formParam.append('description', e.target.description.value)
    formParam.append('csrf_token', this.getCsrfToken())

    if (method === 'put') {
      formParam.append('schedule_id', e.target.schedule_id.value)
    }

    return formParam
  }

  /**
   * Convert Date Object to YYYY-mm-dd
   * @param date                        Date Object.
   * @returns {string}                  Return date YYYY-mm-dd.
   */
  parseDateToDate = (date) => {
    if (Object.prototype.toString.call(date) === '[object Object]') {
      return `${date.year()}-${('0' + (date.month() + 1)).slice(-2)}-${('0' + date.date()).slice(-2)}`
    }
  }

  /**
   * Convert Date Object to HH:ii
   * @param date                        Date Object.
   * @returns {string}                  Return date HH:ii.
   */
  parseDateToTime = (date) => {
    if (Object.prototype.toString.call(date) === '[object Object]') {
      return `${('0' + date.hour()).slice(-2)}:${('0' + date.minute()).slice(-2)}`
    }
  }

  /**
   * Get csrf token
   * @returns {string}                  Return token.
   */
  getCsrfToken = () => {
    const calendar = document.querySelector('#calendar-wrap')
    return (calendar)
      ? calendar.dataset.csrf_token
      : `CSRF token couldn't be found.`
  }

  /**
   * Checking process
   * @param currentProcess              Current process number.
   */
  checkReRender = (currentProcess) => {
    if (currentProcess !== this.calRequireProcess) {
      throw 'exit'
    }
  }

  /**
   * Delete modal display
   */
  deleteModal = () => {
    const elm = document.getElementById('app-modal-back')
    if (elm) {
      elm.parentNode.removeChild(elm)
    }
  }

  /**
   * Create loading display
   * @return {Promise<HTMLDivElement>}  Element of loading display.
   */
  createLoadingDisplay = async () => {
    const loadModal = document.createElement('div')
    loadModal.id = `modal-load-wrap`
    loadModal.innerHTML = `<div class="load"></div>`
    document.querySelector('body').appendChild(loadModal)
    return loadModal
  }

  /**
   * Delete loading display
   * @param loadModal                   Element created by this.createLoadingDisplay().
   */
  deleteLoadingDisplay = (loadModal) => loadModal.parentNode.removeChild(loadModal)

  /**
   * Validate whether element has specific class.
   * @param e                           Event | Element
   * @param className                   Specific class name
   * @return {boolean}
   */
  hasClass = (e, className) => {
    if (e instanceof Event) {
      return e.target.classList.contains(className)
    }

    if (e instanceof HTMLElement) {
      return e.classList.contains(className)
    }

    return false
  }
}
