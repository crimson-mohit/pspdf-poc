(() => {
  new Vue({
    el: '#pspdfkit-app',
    props: {},
    data: {
      pspdfkitWrapper: {
        PSPDFKit: null,
        instance: null,
        pspdfConfiguration: {
          container: "#pspdfkit",
          document: "./assets/document-mark3.pdf",
          styleSheets: [
          "./assets/custom-pspdfkit.css"
          ],
          disableTextSelection: false
        },
        toolbarItems: [],
        listOfAnnotation: [],
        isContextMenuOpen: false,
        currentTextSelection: null
      },
      timer: 3
    },
    async mounted() {
      let timerInterval = setInterval(() => {
        this.timer = this.timer - 1;

        setTimeout(() => {
          this.timer = 0;
          clearInterval(timerInterval);
        }, (this.timer * 1000));
      }, 1000);

      await this.delay(this.timer-1 * 1000);

      this.loadPSPDFKit(this.pspdfkitWrapper.pspdfConfiguration.container).then(async (instance) => {
        this.$emit("loaded", instance);
        this.pspdfkitWrapper.instance = instance;
        console.log('this.pspdfkitWrapper.instance ===> ', this.pspdfkitWrapper.instance);

        const toolbarItems = instance.toolbarItems;
        this.pspdfkitWrapper.toolbarItems = toolbarItems.map(v => ({...v, isSelected: true}));
        instance.setToolbarItems(this.pspdfkitWrapper.toolbarItems);

        instance.contentDocument.addEventListener("mouseup", this.contentDocumentMouseup);

        instance.addEventListener("textSelection.change", this.textSelectionChange);
        instance.addEventListener("annotations.load", this.annotationsLoad);
        instance.addEventListener("annotations.willChange", this.annotationsWillChange);
        instance.addEventListener("annotations.change", this.annotationsChange);
        instance.addEventListener("annotations.create", this.annotationsCreate);
        instance.addEventListener("annotations.update", this.annotationsUpdate);
        instance.addEventListener("annotations.delete", this.annotationsDelete);
      });
    },
    methods: {
      delay(millisec) {
        return new Promise(resolve => {
          setTimeout(resolve, millisec);
        });
      },

      resolveAllPromises(promises, resolve, reject) {
        return Promise.all(promises)
        .then(resolve)
        .catch(reject);
      },

      async loadPSPDFKit(container) {
        this.pspdfkitWrapper.PSPDFKit = PSPDFKit;
        PSPDFKit.unload(container);

        return PSPDFKit.load({
          ...this.pspdfkitWrapper.pspdfConfiguration,
          initialViewState: PSPDFKit.viewStateFromOpenParameters(new PSPDFKit.ViewState({ showToolbar: true }) )
        });
      },

      async textSelectionChange(textSelection) {
        if (textSelection) {
          this.currentTextSelection = {
            currentPageIndex: this.pspdfkitWrapper.instance.viewState.currentPageIndex,
          };

          let isPromiseSuccess = await this.resolveAllPromises([
          textSelection.getBoundingClientRect(),
          textSelection.getText()
          ], (values) => {
            this.currentTextSelection['rect'] = JSON.parse(JSON.stringify(values[0]));
            this.currentTextSelection['text'] = values[1];
            return true;
          }, (error) => {
            console.error('Promise.all error ===> ', error.message);
            return false;
          });

          if(!isPromiseSuccess) {
            this.currentTextSelection = null;
            return;
          }

          const rectsForPage = await textSelection.getSelectedRectsPerPage(
          this.pspdfkitWrapper.instance.viewState.currentPageIndex
          );

          const { rects } = rectsForPage.find((rectsPerPage) =>
          rectsPerPage.pageIndex === this.pspdfkitWrapper.instance.viewState.currentPageIndex
          );

          const customMenu = this.generateMenuElement();

          const rectsObject = this.pspdfkitWrapper.PSPDFKit.Geometry.Rect.union(rects).toJS();

          const item = new this.pspdfkitWrapper.PSPDFKit.CustomOverlayItem({
            id: "custom-pspdfkit-tooltip-overlay",
            node: customMenu,
            pageIndex: this.pspdfkitWrapper.instance.viewState.currentPageIndex,
            position: new this.pspdfkitWrapper.PSPDFKit.Geometry.Point({
              x: rectsObject.left + rectsObject.width,
              y: rectsObject.top
            }),
            onAppear: () => {
              console.log("custom menu appeared !!!");
            }
          });

          this.isContextMenuOpen = true;
          this.pspdfkitWrapper.instance.setCustomOverlayItem(item);
        } else {
          if(this.isContextMenuOpen) {
            setTimeout(() => { // throwing error without timeout
              this.pspdfkitWrapper.instance.removeCustomOverlayItem("custom-pspdfkit-tooltip-overlay");
            }, 0);
          }
        }
      },

      contentDocumentMouseup(event) {
        console.log('contentDocument mouseup ===> ', event);
      },

      annotationsLoad(loadedAnnotations) {
        console.log('annotations.load ===> ', loadedAnnotations);
      },

      annotationsWillChange(event) {
        if (event.reason === this.pspdfkitWrapper.PSPDFKit.AnnotationsWillChangeReason.DRAW_START) {
          console.log("The user is drawing...");
        }
      },

      annotationsChange() {
        console.log("Something in the annotations has changed.");
      },

      annotationsCreate(createdAnnotations) {
        console.log('annotations.create ===> ', createdAnnotations);
      },

      annotationsUpdate(updatedAnnotations) {
        console.log('annotations.update ===> ', updatedAnnotations);
      },

      annotationsDelete(deletedAnnotations) {
        console.log('annotations.delete ===> ', deletedAnnotations);
      },

      updateToolbar(item) {
        item.isSelected = !item.isSelected;
        this.pspdfkitWrapper.instance.setToolbarItems(this.pspdfkitWrapper.toolbarItems.filter((item) => item.isSelected));
      },

      onContextMenuSelection(action) {
        console.log('onContextMenuSelection ===> ', action, this.currentTextSelection);
        switch (action) {
          case 'about':
          break;
          case 'calendar':
          break;
          case 'courses':
          break;
          case 'contact':
          break;
          case 'faculty':
          break;
          case 'login':
          break;

          default:
          console.log('This should never happen !!!');
          break;
        }
      },

      generateMenuElement() {
        const customMenu = document.createElement("div");
        customMenu.onpointerup = e => {
          e.stopPropagation();
          this.isContextMenuOpen = false;
          this.pspdfkitWrapper.instance.removeCustomOverlayItem("custom-pspdfkit-tooltip-overlay");
          this.onContextMenuSelection(e.target.getAttribute('data-id'));
        }
        customMenu.className = "custom-pspdfkit-tooltip-overlay"
        customMenu.innerHTML = `
        <ul id="context-menu">
          <li data-id="about">About</li>
          <li data-id="calendar">Calendar</li>
          <li data-id="courses">Courses</li>
          <li data-id="contact">Contact Us</li>
          <li data-id="faculty">Faculty Directory</li>
          <li data-id="login">Login</li>
        </ul>
        `;

        return customMenu;
      },
      beforeUnmount() {
        this.pspdfkitWrapper.instance.contentDocument.removeEventListener("mouseup", this.contentDocumentMouseup);
        this.pspdfkitWrapper.instance.removeEventListener("textSelection.change", this.textSelectionChange);
        this.pspdfkitWrapper.instance.removeEventListener("annotations.load", this.annotationsLoad);
        this.pspdfkitWrapper.instance.removeEventListener("annotations.willChange", this.annotationsWillChange);
        this.pspdfkitWrapper.instance.removeEventListener("annotations.change", this.annotationsChange);
        this.pspdfkitWrapper.instance.removeEventListener("annotations.create", this.annotationsCreate);
        this.pspdfkitWrapper.instance.removeEventListener("annotations.update", this.annotationsUpdate);
        this.pspdfkitWrapper.instance.removeEventListener("annotations.delete", this.annotationsDelete);
        this.pspdfkitWrapper.PSPDFKit.unload(this.pspdfkitWrapper.pspdfConfiguration.container);
      },
      unmounted() {
        console.log('unmounted ===> ', this.pspdfkitWrapper);
        alert('unmounted');
      }
    }
  });
})();
