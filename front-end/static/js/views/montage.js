import { haveAccess } from "../service/auth.js";
import { uploadImage } from "../service/file.js";
import { getAllImage, getImage, removeImage } from "../service/file.js";
import AbstractView from "./AbstractView.js";

export default class extends AbstractView {
  constructor() {
    super();

    this.setTitle('Montage');
    this.fileArray = [];
    this.filter = '';
  }

  async getHtml() {
    return await haveAccess().then(async res => {
      if (res) {
        return `
          <h1>Montage</h1>

          <hr>

          <div class="camera-container">
            <div class="camera-content">
              <video id="open-camera" class="open-camera" autoplay playsinline></video>
              <ul class="filter-container">
                <li><canvas id="filter-sepia" class="filter-sepia"></canvas></li>
                <li><canvas id="filter-grayscale" class="filter-grayscale"></canvas></li>
                <li><canvas id="filter-brightness" class="filter-brightness"></canvas></li>
                <li><canvas id="filter-contrast" class="filter-contrast"></canvas></li>
              </ul>
              <canvas id="take-by-camera" class="open-camera" style="display: none;"></canvas>
              <button id="button-snap" class="camera-snap-btn material-icons">photo_camera</button>
              <button id="collect-publish" class="camera-publish-btn material-icons" style="display: none;">publish</button>
              <button id="collect-cancel" class="camera-cancel-btn material-icons" style="display: none;">cancel</button>
            </div>
            <div>
              <ul id="image-collect" class="image-collect-container"></ul>
            </div>
            <div>
              <input type="file" id="load-image" name="load-image" accept=image/jpeg>
              <button id="upload-image">upload</button>
            </div>
          </div>
        `;
      }
      else return '';
    })
  }

  async openCamera() {
    const openCamera = document.getElementById('open-camera');
    const snapBtn = document.getElementById('button-snap');
    const publishBtn = document.getElementById('collect-publish')
    const cancelBtn = document.getElementById('collect-cancel');

    this.snapBtnSwitch(false);
    this.addFilter();
  
    await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true
    })
    .then(stream => {
      openCamera.srcObject = stream;
      openCamera.addEventListener('loadedmetadata', async () => {
        const imageInfo = {
          width: openCamera.videoWidth,
          height: openCamera.videoHeight,
          imageIdx: 0
        };

        snapBtn.onclick = () => {
          this.createNewThumbnail(openCamera, imageInfo);
          this.activeCamera(openCamera, stream, true);
        }

        publishBtn.onclick = async () => {
          await this.uploadThumbnail().then();
          await this.loadCollectImage().then();
          this.activeCamera(openCamera, stream, false);
        }

        cancelBtn.onclick = () => {
          this.activeCamera(openCamera, stream, false);
        }
      });
    })
    .catch(err => {
      alert('Your browser don\'t support camera!');
    });
  }

  async uploadImageFromFile() {
    const fileLoaded = document.getElementById('load-image');
    const uploadBtn = document.getElementById('upload-image');

    uploadBtn.onclick = async() => {
      const file = fileLoaded.files[0];
      if (file && file.type !== 'image/jpeg') {
        alert('You only can upload a jpeg image');
        return ;
      }

      const fileData = await this.blobToDataUrl(file);
      const res = await uploadImage(fileData).then(data => data);
      if (!res) alert('Some upload failed!');
      else {
        alert('Upload success!');
        await this.loadCollectImage().then();
      }
    }
  }

  async blobToDataUrl(blob) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = (e) => { return resolve(e); }
      reader.readAsDataURL(blob);
    }).then(e => e.target.result);
  }

  addFilter() {
    const filterSepia = document.getElementById('filter-sepia');
    const filterGrayscal = document.getElementById('filter-grayscale');
    const filterBrightness = document.getElementById('filter-brightness');
    const filterContrast = document.getElementById('filter-contrast');

    const filterArray = [filterSepia, filterGrayscal, filterBrightness, filterContrast];
    for (const filter of filterArray) {
      filter.width = 150;
      filter.height = 150;
      this.exampleCtx(filter.getContext("2d"))
    }

    const openCameraFilter = document.getElementById('open-camera').style;

    filterSepia.onclick = () => {
      this.snapBtnSwitch(true);
      openCameraFilter.filter = this.filter = this.filterSepia();
    }

    filterGrayscal.onclick = () => {
      this.snapBtnSwitch(true);
      openCameraFilter.filter = this.filter = this.filterGrayscal();
    }

    filterBrightness.onclick = () => {
      this.snapBtnSwitch(true);
      openCameraFilter.filter = this.filter = this.filterBrightness();
    }

    filterContrast.onclick = () => {
      this.snapBtnSwitch(true);
      openCameraFilter.filter = this.filter = this.filterContrast();
    }
  }

  exampleCtx(ctx) {
    ctx.beginPath();
    ctx.arc(75, 75, 50, 0, Math.PI * 2, true);
    ctx.moveTo(110, 75);
    ctx.arc(75, 75, 35, 0, Math.PI, false);
    ctx.moveTo(65, 65);
    ctx.arc(60, 65, 5, 0, Math.PI * 2, true);
    ctx.moveTo(95, 65);
    ctx.arc(90, 65, 5, 0, Math.PI * 2, true);
    ctx.stroke();
  }

  activeCamera(camera, stream, on) {
    const canvas = document.getElementById('take-by-camera');
    const snapBtn = document.getElementById('button-snap');
    const publishBtn = document.getElementById('collect-publish')
    const cancelBtn = document.getElementById('collect-cancel');

    if (on === true) {
      camera.srcObject = null;
      camera.style.display = 'none';
      canvas.style.display = '';
      snapBtn.style.display = 'none';
      publishBtn.style.display = '';
      cancelBtn.style.display = '';
    }
    else {
      camera.style.display = '';
      camera.srcObject = stream;
      canvas.style.display = 'none';
      snapBtn.style.display = '';
      publishBtn.style.display = 'none'
      cancelBtn.style.display = 'none';
    }
  }

  async loadCollectImage() {
    const collect = document.getElementById('image-collect');
    const res = await getAllImage().then(res => res);
    this.fileArray = Array.from(res.files).sort((file1, file2) => {
      if (file1.date > file2.date) return 1;
      else if (file1.date < file2.date) return -1;
      return 0;
    });

    const childNodeFromCollect = Array.from(collect.childNodes);
    for (const child of childNodeFromCollect)
      collect.removeChild(child);

    for (const file of this.fileArray)
      await this.createImage(file);
  }

  async createImage(file) {
    const collect = document.getElementById('image-collect');

    const data = await getImage(file.id);
    if (data && data.user === file.user) {
      const newList = document.createElement('li');
      const newImage = document.createElement('img');
      const deleteImgBtn = document.createElement('span');

      newList.classList.add('image-collect-thumbnail-container');

      newImage.id = file.id;
      newImage.src = file.data;
      newImage.classList.add('image-collect-thumbnail');

      deleteImgBtn.id = data.id;
      deleteImgBtn.classList.add('image-delete', 'material-icons');;
      deleteImgBtn.innerHTML = 'close';
      deleteImgBtn.onclick = async () => {
        if (confirm('You really want delete this image?') === true) {
          this.fileArray.splice(this.fileArray.indexOf(file), 1);
          await this.deleteImage(newList, file.id);
        }
      }
      
      collect.appendChild(newList);
      newList.appendChild(newImage);
      newList.appendChild(deleteImgBtn);
    }
  }

  async deleteImage(imageNode, nodeId) {
    const collect = document.getElementById('image-collect');

    const res = await removeImage(nodeId).then(data => data);
    if (res) alert(`Image ${nodeId} has delete!`);
    else {
      alert('Something wrong!');
      return ;
    }
    collect.removeChild(imageNode);
  }

  createNewThumbnail(src, imageInfo) {
    const canvas = document.getElementById('take-by-camera')

    canvas.width = imageInfo.width;
    canvas.height = imageInfo.height;
    canvas.getContext('2d').filter = this.filter;
    canvas.getContext('2d').drawImage(src, 0, 0);
  }

  async uploadThumbnail() {
    const thumbnail = document.getElementById('take-by-camera');
    const context = thumbnail.getContext('2d');
    const image = thumbnail.toDataURL('image/jpeg', 1.0);
  
    const res = await uploadImage(image).then(data => data);
    if (!res) alert('Some upload failed!');
    else {
      alert('Upload success!');
      context.clearRect(0, 0, thumbnail.width, thumbnail.height);
    }
  }

  snapBtnSwitch(onOff) {
    const snapBtn = document.getElementById('button-snap');

    snapBtn.disabled = onOff ? false : true;
  }

  filterSepia() { return 'sepia(100%)' };
  filterGrayscal() { return 'grayscale(100%)' };
  filterBrightness() { return 'brightness(0.35)' };
  filterContrast() { return 'contrast(140%)' };
}