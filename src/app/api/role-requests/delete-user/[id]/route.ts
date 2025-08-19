import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

const DB_NAME = process.env.DB_NAME || 'my-next-app'

export async function DELETE(req: Request) {
  try {
    const client = await clientPromise
    const db = client.db(DB_NAME)
    const usersCollection = db.collection('users')

    // Extract the user ID from the URL parameter
    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/')
    const id = pathSegments[pathSegments.length - 1] // This will get the 'id' from the URL

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 },
      )
    }

    // Perform the soft delete
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

export async function OPTIONS() {
  return NextResponse.json({ allowedMethods: ['DELETE'] })
}
