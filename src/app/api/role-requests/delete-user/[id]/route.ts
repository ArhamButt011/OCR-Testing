import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'
import { withLogging } from '@/lib/apiWrapper'

const DB_NAME = process.env.DB_NAME || 'my-next-app'

async function deleteUserHandler(
  req: Request,
  context?: any
) {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const usersCollection = db.collection('users')

    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/')
    const id = pathSegments[pathSegments.length - 1] 

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 },
      )
    }

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(
      { message: 'User deleted successfully' },
      { status: 200 },
    )
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user.' },
      { status: 500 },
    )
  }
}

export const DELETE = withLogging(deleteUserHandler)

async function optionsHandler() {
  return NextResponse.json({ allowedMethods: ['DELETE'] })
}

export const OPTIONS = withLogging(optionsHandler)
