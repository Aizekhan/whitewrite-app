import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  DocumentData
} from 'firebase/firestore';
import { db } from './config';

// Collection references
export const usersCollection = () => collection(db, 'users');
export const projectsCollection = () => collection(db, 'projects');

// User operations
export const createUser = async (uid: string, data: DocumentData) => {
  await setDoc(doc(usersCollection(), uid), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
};

export const getUser = async (uid: string) => {
  const docSnap = await getDoc(doc(usersCollection(), uid));
  return docSnap.exists() ? docSnap.data() : null;
};

// Project operations
export const createProject = async (projectId: string, uid: string, data: DocumentData) => {
  await setDoc(doc(projectsCollection(), projectId), {
    ...data,
    owner: uid,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
};

export const getProject = async (projectId: string) => {
  const docSnap = await getDoc(doc(projectsCollection(), projectId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

export const getUserProjects = async (uid: string) => {
  const q = query(
    projectsCollection(),
    where('owner', '==', uid),
    orderBy('updatedAt', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const updateProject = async (projectId: string, data: Partial<DocumentData>) => {
  await updateDoc(doc(projectsCollection(), projectId), {
    ...data,
    updatedAt: Timestamp.now()
  });
};

export const deleteProject = async (projectId: string) => {
  await deleteDoc(doc(projectsCollection(), projectId));
};
